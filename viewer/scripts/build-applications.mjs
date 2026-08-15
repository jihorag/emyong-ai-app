// 개념 활용 문항 빌더.
//
// scripts/apply-seed/{unitId}.js 의 압축 표기를 public/data/applications/ 의
// JSON 으로 편다. 사람이 쓸 때는 압축 표기가 편하고, 앱이 읽을 때는 JSON 이 낫다.
//
//   node scripts/build-applications.mjs
//
// ⚠ 여기서 나온 문항은 전부 status: 'draft' 다. 임용 콘텐츠를 아는 사람이
//   검토하고 reviewedAt 을 채우기 전까지는 학생 화면에 '검수 전 초안'으로 뜬다.

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(here, 'apply-seed');
const OUT_DIR = join(here, '..', 'public', 'data', 'applications');

const SOURCE = '쿠키넷 수학 B기본이론 · 수학교육론 p.5–76';

const files = (await readdir(SEED_DIR)).filter((f) => f.endsWith('.js')).sort();
await mkdir(OUT_DIR, { recursive: true });

let totalItems = 0;
for (const f of files) {
  const unitId = f.replace(/\.js$/, '');
  const { default: rows } = await import(join(SEED_DIR, f));

  const items = rows.map(([conceptId, situation, question, rubric, modelAnswer], i) => ({
    id: `A${i + 1}`,
    conceptId,
    unitId,
    situation,
    question,
    rubric: rubric.map(([label, keywords, points], j) => ({
      id: `r${j + 1}`, label, points, keywords,
    })),
    modelAnswer,
    source: SOURCE,
    status: 'draft',
    reviewedAt: null,
  }));

  // 형식 점검 — 여기서 걸러야 앱에서 배점이 어긋나지 않는다.
  items.forEach((it) => {
    if (!it.situation || !it.question || !it.modelAnswer) throw new Error(`${unitId}/${it.id}: 빈 항목`);
    if (it.rubric.length !== 3) throw new Error(`${unitId}/${it.id}: 채점요소가 3개가 아님`);
    it.rubric.forEach((r) => {
      if (!r.label || !r.keywords?.length) throw new Error(`${unitId}/${it.id}/${r.id}: 라벨·키워드 누락`);
    });
  });

  const out = {
    _읽어보세요: [
      'scripts/build-applications.mjs 가 생성한 파일. 직접 고치지 말고 scripts/apply-seed/ 를 고칠 것.',
      '전부 status: draft — 임용 콘텐츠 검토자가 확인하고 reviewedAt 을 채워야 학생에게 검수 완료로 표시된다.',
    ],
    schemaVersion: 1,
    unitId,
    items,
  };
  await writeFile(join(OUT_DIR, `${unitId}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8');
  totalItems += items.length;
  console.log(`  ${unitId}  ${items.length}문항 · ${items.reduce((n, x) => n + x.rubric.reduce((m, r) => m + r.points, 0), 0)}점`);
}
console.log(`\n총 ${files.length}단원 · ${totalItems}문항`);
