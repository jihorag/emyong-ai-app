
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const MODELS = {
  primary: 'claude-sonnet-4-6',
  fast: 'claude-haiku-4-5-20251001',
  premium: 'claude-opus-4-7',
};

function getEndpoint(baseUrl) {
  return (baseUrl && baseUrl.trim()) ? baseUrl.trim().replace(/\/$/, '') + '/v1/messages' : API_URL;
}

export async function sendMessages({
  apiKey,
  model = MODELS.primary,
  system,
  messages,
  maxTokens = 1024,
  baseUrl,
  signal,
  onDelta,
}) {
  const stream = typeof onDelta === 'function';
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    stream,
  };
  const useProxy = !apiKey;
  const endpoint = useProxy ? '/api/ai' : getEndpoint(baseUrl);
  const headers = useProxy
    ? { 'content-type': 'application/json' }
    : {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-beta': 'extended-cache-ttl-2025-04-11',
      };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch { }
    if (res.status === 503 && useProxy) {
      throw new Error('내장 AI가 꺼져 있어요. ⚙️ 설정에서 본인 API 키를 넣으면 바로 쓸 수 있어요.');
    }
    if (res.status === 429) {
      throw new Error('잠시 요청이 많아요. 조금 뒤 다시 시도하거나, ⚙️ 설정에서 본인 키를 넣어 주세요.');
    }
    throw new Error(`Claude API ${res.status} ${res.statusText}${detail ? ': ' + detail : ''}`);
  }
  if (!stream) {
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return {
      text,
      usage: data.usage || {},
      stop_reason: data.stop_reason,
      raw: data,
    };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let usage = {};
  let stop_reason = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        const chunk = evt.delta.text || '';
        text += chunk;
        try { onDelta(chunk, text); } catch { }
      } else if (evt.type === 'message_delta') {
        if (evt.usage) usage = { ...usage, ...evt.usage };
        if (evt.delta?.stop_reason) stop_reason = evt.delta.stop_reason;
      } else if (evt.type === 'message_start' && evt.message?.usage) {
        usage = { ...usage, ...evt.message.usage };
      }
    }
  }
  return { text, usage, stop_reason };
}
