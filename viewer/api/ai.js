// ⚠ 키는 서버 환경변수(ANTHROPIC_API_KEY)에만 둔다. 브라우저로 내려보내지 않는다.
// ⚠ 공유 키라 오남용 방지가 필수다 — Origin 허용목록 · IP 레이트리밋 · 모델/토큰 상한.
// ⚠ 리미터는 웜 인스턴스 메모리라 콜드스타트에 리셋된다. 실효 상한이 아니다.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-7',
]);

const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
const MAX_TOKENS_CAP = num(process.env.AI_MAX_TOKENS_CAP, 4096);
const RATE_PER_MIN = num(process.env.AI_RATE_PER_MIN, 20);
const RATE_PER_DAY = num(process.env.AI_RATE_PER_DAY, 300);
const GLOBAL_PER_DAY = num(process.env.AI_GLOBAL_PER_DAY, 8000);

const ipMinute = new Map();
const ipDay = new Map();
let globalDay = { day: '', count: 0 };

function today() { return new Date().toISOString().slice(0, 10); }

function checkRate(ip) {
  const now = Date.now();
  const arr = (ipMinute.get(ip) || []).filter((t) => now - t < 60_000);
  if (arr.length >= RATE_PER_MIN) return { ok: false, retry: 60 };
  arr.push(now); ipMinute.set(ip, arr);
  const d = today();
  const rec = ipDay.get(ip);
  const cur = rec && rec.day === d ? rec : { day: d, count: 0 };
  if (cur.count >= RATE_PER_DAY) return { ok: false, retry: 3600 };
  cur.count += 1; ipDay.set(ip, cur);
  if (globalDay.day !== d) globalDay = { day: d, count: 0 };
  if (globalDay.count >= GLOBAL_PER_DAY) return { ok: false, retry: 3600, global: true };
  globalDay.count += 1;
  if (ipMinute.size > 5000) ipMinute.clear();
  if (ipDay.size > 20000) ipDay.clear();
  return { ok: true };
}

function hostOf(url) {
  try { return new URL(url).host.toLowerCase(); } catch { return ''; }
}

function originAllowed(req) {
  const list = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = hostOf(origin) || hostOf(referer);
  if (!host) return false;
  if (list.length) {
    return list.some((allowed) => host === hostOf(allowed.startsWith('http') ? allowed : 'https://' + allowed) || host === allowed);
  }
  return host.endsWith('.vercel.app') || host === 'localhost' || host.startsWith('localhost:') || host.startsWith('127.0.0.1');
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  if (!originAllowed(req)) { res.status(403).json({ error: 'forbidden origin' }); return; }

  const rl = checkRate(clientIp(req));
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retry || 60));
    res.status(429).json({ error: rl.global ? '오늘 공용 AI 사용량이 많아요. 잠시 후 다시 시도해주세요.' : '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') { res.status(400).json({ error: 'invalid body' }); return; }

  const { model, system, messages, max_tokens, stream } = body;
  if (!ALLOWED_MODELS.has(model)) { res.status(400).json({ error: 'model not allowed' }); return; }
  if (!Array.isArray(messages) || messages.length === 0) { res.status(400).json({ error: 'messages required' }); return; }

  const cappedMax = Math.min(num(max_tokens, 1024), MAX_TOKENS_CAP);
  const wantStream = !!stream;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: '내장 AI 키가 아직 설정되지 않았어요. (서버 ANTHROPIC_API_KEY 필요)' }); return; }

  const upstreamBody = { model, max_tokens: cappedMax, messages, stream: wantStream };
  if (system) upstreamBody.system = system;

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'anthropic-beta': 'extended-cache-ttl-2025-04-11',
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch {
    res.status(502).json({ error: 'upstream 연결 실패' });
    return;
  }

  if (!upstream.ok) {
    let msg = '';
    try { msg = (await upstream.json())?.error?.message || ''; } catch {}
    res.status(upstream.status).json({ error: { message: msg || 'AI 요청 실패' } });
    return;
  }

  if (wantStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });
    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch {}
    res.end();
    return;
  }

  const data = await upstream.json();
  res.status(200).json(data);
}
