// 개념 활용 문항 초안 생성기 — 오프라인 도구.
//
// ═══════════════════════════════════════════════════════════════
//  앱은 문항을 실시간으로 만들지 않는다. 이 스크립트는 그 원칙을 지키면서
//  초안을 뽑는 자리다 — 여기서 나온 것은 전부 status: 'draft' 이고,
//  사람이 검토해 reviewedAt 을 채워야 학생에게 '검수 완료'로 나간다.
// ═══════════════════════════════════════════════════════════════
//
// 쓰는 법
//   viewer/.env.local 에 ANTHROPIC_API_KEY=sk-ant-... 를 넣고
//
//   node scripts/gen-applications.mjs --list          대상 단원만 보기
//   node scripts/gen-applications.mjs --unit math__gakron__12
//   node scripts/gen-applications.mjs --area 각론 --limit 5
//   node scripts/gen-applications.mjs --all
//
// 이미 scripts/apply-seed/{unitId}.js 가 있으면 건너뛴다(--force 로 덮어쓰기).
// 한 단원씩 파일로 떨어지므로 중간에 끊겨도 이어서 돌리면 된다.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SEED_DIR = join(here, 'apply-seed');
const MODEL = 'claude-sonnet-4-6';

// ── 인자 ──────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

// ── 대상 단원 모으기 ──────────────────────────────────────────
const tax = JSON.parse(await readFile(join(ROOT, 'public/data/taxonomy/math.json'), 'utf8'));
const units = [];
JSON.stringify(tax, (k, v) => {
  if (v && v.id && v.title && v.study_file) units.push({ id: v.id, title: v.title, file: v.study_file });
  return v;
});

let targets = units;
if (val('unit')) targets = units.filter((u) => u.id === val('unit'));
if (val('area')) targets = targets.filter((u) => u.id.includes(val('area')));
if (val('limit')) targets = targets.slice(0, Number(val('limit')));

if (flag('list')) {
  targets.forEach((u) => console.log(`${u.id}\t${u.title}\t${u.file}`));
  console.log(`\n총 ${targets.length}단원`);
  process.exit(0);
}

// ── 프롬프트 ──────────────────────────────────────────────────
// 앱의 채점 프롬프트와 달리, 이건 사람이 검토할 초안을 만드는 용도다.
// 그래도 근거 밖으로 나가지 못하게 묶는다 — 검토 비용을 줄이는 게 핵심이다.
const SYSTEM = [
  '당신은 초등 임용 논술형 문항 출제자입니다.',
  '주어진 학습 노트의 내용만 사용하고, 노트에 없는 이론·용어·수치를 만들지 마십시오.',
  '각 문항은 실제 초등 수업 장면을 2~4문장으로 제시하고, 그 장면에 개념을 적용해',
  '서술하게 하는 요구를 한 줄로 덧붙입니다.',
  '채점요소는 정확히 3개, 각 2점으로 하고, 서로 겹치지 않게 하십시오.',
  '채점요소마다 핵심 키워드를 2~4개 제시합니다. 키워드는 노트에 나오는 표현이어야 합니다.',
  '모범답안은 3~4문장으로, 세 채점요소를 모두 담아 작성하십시오.',
  '문항끼리 상황이 겹치지 않게 하십시오.',
  'JSON 외의 텍스트는 출력하지 마십시오.',
].join('\n');

const buildUser = (title, note, n) => [
  `[단원] ${title}`,
  '', '[학습 노트]', note.slice(0, 20000),
  '',
  `위 노트만 근거로 개념 활용 문항 ${n}개를 만들어 아래 형식의 JSON만 출력하십시오.`,
  '{"items":[{"conceptId":"짧은영문키","situation":"수업 장면","question":"요구 사항 한 줄",',
  '"rubric":[{"label":"항목명","points":2,"keywords":["키워드1","키워드2"]}],',
  '"modelAnswer":"모범답안"}]}',
].join('\n');

// ── 호출 ──────────────────────────────────────────────────────
async function loadKey() {
  try {
    const env = await readFile(join(ROOT, '.env.local'), 'utf8');
    const m = env.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* 없으면 아래 */ }
  return process.env.ANTHROPIC_API_KEY || null;
}

const KEY = await loadKey();
if (!KEY) {
  console.error('ANTHROPIC_API_KEY 가 없습니다. viewer/.env.local 에 넣거나 환경변수로 주세요.');
  process.exit(1);
}

async function ask(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  return (j.content || []).map((c) => c.text || '').join('');
}

// ── 노트에서 이 단원 부분만 ───────────────────────────────────
// 여러 단원이 한 파일을 공유하면(수학교육론 등) '## 제목' 섹션만 잘라 쓴다.
function sliceNote(md, title) {
  const lines = md.split('\n');
  const s = lines.findIndex((l) => /^##\s/.test(l) && l.includes(title));
  if (s < 0) return md;
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i += 1) if (/^##\s/.test(lines[i])) { e = i; break; }
  return lines.slice(s, e).join('\n');
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

// ── 본체 ──────────────────────────────────────────────────────
await mkdir(SEED_DIR, { recursive: true });
const N = Number(val('count') || 10);
let done = 0; let skipped = 0; let failed = 0;

for (const u of targets) {
  const out = join(SEED_DIR, `${u.id}.js`);
  if (!flag('force')) {
    try { await access(out); skipped += 1; console.log(`· ${u.id} 건너뜀(이미 있음)`); continue; } catch { /* 없으면 진행 */ }
  }
  try {
    const raw = await readFile(join(ROOT, 'public/data/study/math', u.file), 'utf8');
    const note = sliceNote(raw, u.title);
    if (note.trim().length < 200) { console.log(`· ${u.id} 건너뜀(노트가 너무 짧음)`); skipped += 1; continue; }

    const text = await ask(SYSTEM, buildUser(u.title, note, N));
    const m = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m[0]);
    const items = (parsed.items || []).filter((it) =>
      it.situation && it.question && it.modelAnswer && Array.isArray(it.rubric) && it.rubric.length === 3);
    if (!items.length) throw new Error('쓸 만한 문항이 없음');

    const body = items.map((it) => {
      const rub = it.rubric.map((r) =>
        `['${esc(r.label)}', [${(r.keywords || []).map((k) => `'${esc(k)}'`).join(', ')}], 2]`).join(',\n     ');
      return `  ['${esc(it.conceptId || 'apply')}', '${esc(it.situation)}',\n    '${esc(it.question)}',\n    [${rub}],\n    '${esc(it.modelAnswer)}'],`;
    }).join('\n\n');

    await writeFile(out,
      `// ${u.title} — 자동 생성 초안. 사람이 검토해야 한다.\n`
      + `// 생성: scripts/gen-applications.mjs · 근거: ${u.file}\n`
      + `export default [\n${body}\n];\n`, 'utf8');
    done += 1;
    console.log(`✓ ${u.id} ${u.title} — ${items.length}문항`);
  } catch (e) {
    failed += 1;
    console.error(`✗ ${u.id} ${u.title} — ${e.message}`);
  }
}

console.log(`\n생성 ${done} · 건너뜀 ${skipped} · 실패 ${failed}`);
console.log('다음: node scripts/build-applications.mjs 로 JSON 을 만드세요.');
console.log('⚠ 전부 검수 전 초안입니다. 학생 화면에 그렇게 표시됩니다.');
