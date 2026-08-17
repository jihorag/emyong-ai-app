#!/usr/bin/env node
// 회귀 검증 — 구조를 옮겨도 "기능이 안 바뀌었다"를 기계가 판정한다.
//
//   node test/verify.mjs            기준선과 대조, 다르면 exit 1
//   node test/verify.mjs --update   현재 상태를 새 기준선으로 저장
//   node test/verify.mjs --shots    스크린샷도 남김 (test/output/)
//
// 판정 항목
//   1. 화면 렌더        기대한 요소가 보이는가
//   2. localStorage 키  데이터 계층을 옮겨도 저장 스키마가 그대로인가
//   3. AI 프롬프트      프롬프트를 옮겨도 조립 결과가 바이트 단위로 같은가  ★
//   4. 콘솔 에러        0인가
//   5. 대시보드 수치    학습 후 지표가 실제로 움직이는가
//
// dist를 `vite preview`로 띄워 검증한다 — 개발 서버가 아니라 실제 배포물을 본다.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'baseline');
const OUT = join(HERE, 'output');
const PORT = 4183;
const URL = `http://localhost:${PORT}/`;

const UPDATE = process.argv.includes('--update');
const SHOTS = process.argv.includes('--shots') || UPDATE;

const c = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', x: '\x1b[0m', b: '\x1b[1m' };
const ok = (m) => console.log(`  ${c.g}✓${c.x} ${m}`);
const bad = (m) => console.log(`  ${c.r}✗${c.x} ${m}`);
const info = (m) => console.log(`  ${c.d}${m}${c.x}`);

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch {
  console.error(`${c.r}playwright-core가 없습니다.${c.x}  npm i -D playwright-core`);
  process.exit(1);
}

if (!existsSync(join(HERE, '..', 'dist', 'index.html'))) {
  console.error(`${c.r}dist/가 없습니다.${c.x}  먼저 npm run build`);
  process.exit(1);
}

// ── preview 서버 기동 ────────────────────────────────────────
// stdout의 "Local:" 문자열을 기다리는 대신 실제로 HTTP가 응답할 때까지 폴링한다.
// vite 버전·환경에 따라 출력 형식이 달라져 CI에서 오탐이 났었다.
const bin = join(HERE, '..', 'node_modules', '.bin', 'vite');
const server = spawn(bin, ['preview', '--port', String(PORT), '--strictPort'],
  { cwd: join(HERE, '..'), stdio: ['ignore', 'pipe', 'pipe'] });

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

const stop = () => { try { server.kill('SIGTERM'); } catch { /* 이미 종료 */ } };
process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(130); });

let exited = null;
server.on('exit', (code) => { exited = code; });

const deadline = Date.now() + 60000;
for (;;) {
  if (exited !== null) {
    console.error(`${c.r}preview 서버가 종료됨 (code ${exited})${c.x}\n${serverLog}`);
    process.exit(1);
  }
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(2000) });
    if (r.ok) break;
  } catch { /* 아직 안 뜸 */ }
  if (Date.now() > deadline) {
    stop();
    console.error(`${c.r}preview 서버 기동 타임아웃(60s)${c.x}\n${serverLog || '(출력 없음)'}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\n${c.b}회귀 검증${c.x} ${c.d}— ${URL}${c.x}\n`);
if (SHOTS) mkdirSync(OUT, { recursive: true });

const { drive } = await import('./drive.mjs');
let now;
try {
  now = await drive(chromium, URL, { screenshotDir: SHOTS ? OUT : null });
} catch (e) {
  stop();
  console.error(`${c.r}구동 실패:${c.x} ${e.message}`);
  process.exit(1);
}
stop();

// ── 기준선 갱신 모드 ─────────────────────────────────────────
if (UPDATE) {
  mkdirSync(BASE, { recursive: true });
  writeFileSync(join(BASE, 'screens.json'), JSON.stringify(now.screens, null, 2) + '\n');
  writeFileSync(join(BASE, 'storage-keys.json'), JSON.stringify(now.storageKeys, null, 2) + '\n');
  writeFileSync(join(BASE, 'prompt-kinds.json'), JSON.stringify(now.promptKinds, null, 2) + '\n');
  for (const [kind, text] of Object.entries(now.prompts)) {
    writeFileSync(join(BASE, `prompt.${kind}.system.txt`), text);
  }
  for (const [kind, text] of Object.entries(now.userMessages)) {
    writeFileSync(join(BASE, `prompt.${kind}.user.txt`), text ?? '');
  }
  ok(`기준선 저장 — 화면 ${Object.keys(now.screens).length} · 저장키 ${now.storageKeys.length} · 프롬프트 ${now.promptKinds.length}종`);
  info(`프롬프트: ${now.promptKinds.join(', ')}`);
  info(`대시보드: 점수 ${now.dashboard.before.score} → ${now.dashboard.after.score}, ${now.dashboard.after.sub}`);
  process.exit(0);
}

// ── 대조 ─────────────────────────────────────────────────────
const read = (f) => { try { return readFileSync(join(BASE, f), 'utf8'); } catch { return null; } };
const readJson = (f) => { const s = read(f); return s ? JSON.parse(s) : null; };
let fail = 0;

console.log(`${c.b}1. 화면 렌더${c.x}`);
const baseScreens = readJson('screens.json');
if (!baseScreens) { bad('기준선 없음 — node test/verify.mjs --update 를 먼저'); process.exit(1); }
for (const [k, v] of Object.entries(baseScreens)) {
  if (now.screens[k] === v) continue;
  bad(`${k}: 기준 ${v} → 현재 ${now.screens[k]}`); fail++;
}
for (const [k, v] of Object.entries(now.screens)) if (!v) { bad(`${k}: 렌더 실패`); fail++; }
if (!fail) ok(`${Object.keys(now.screens).length}개 화면 정상`);

console.log(`\n${c.b}2. localStorage 키${c.x}`);
const baseKeys = readJson('storage-keys.json') || [];
const added = now.storageKeys.filter((k) => !baseKeys.includes(k));
const removed = baseKeys.filter((k) => !now.storageKeys.includes(k));
if (added.length || removed.length) {
  removed.forEach((k) => { bad(`사라짐: ${k}  ← 기존 사용자 데이터 유실 위험`); fail++; });
  added.forEach((k) => { bad(`새로 생김: ${k}`); fail++; });
} else ok(`${baseKeys.length}개 키 일치`);

console.log(`\n${c.b}3. AI 프롬프트 (바이트 단위)${c.x}`);
const baseKinds = readJson('prompt-kinds.json') || [];
for (const kind of baseKinds) {
  for (const [role, got] of [['system', now.prompts[kind]], ['user', now.userMessages[kind]]]) {
    const expected = read(`prompt.${kind}.${role}.txt`);
    if (expected == null) continue;
    if (got == null) { bad(`${kind}.${role}: 이번엔 호출되지 않음`); fail++; continue; }
    if (expected === got) { ok(`${kind}.${role} — ${got.length.toLocaleString()}자 동일`); continue; }
    fail++;
    bad(`${kind}.${role}: 달라짐 (기준 ${expected.length}자 → 현재 ${got.length}자)`);
    const a = expected.split('\n'), b = got.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] === b[i]) continue;
      info(`  L${i + 1} 기준: ${JSON.stringify((a[i] ?? '').slice(0, 90))}`);
      info(`  L${i + 1} 현재: ${JSON.stringify((b[i] ?? '').slice(0, 90))}`);
      break;
    }
  }
}
for (const kind of now.promptKinds) {
  if (!baseKinds.includes(kind)) { bad(`새 프롬프트 종류: ${kind}`); fail++; }
}
if (now.promptKinds.includes('unknown')) { bad('분류 실패한 프롬프트가 있음 — mock-ai.mjs classify() 확인'); fail++; }

console.log(`\n${c.b}4. 콘솔 에러${c.x}`);
if (now.consoleErrors.length) {
  now.consoleErrors.slice(0, 6).forEach((e) => { bad(e); fail++; });
} else ok('없음');

console.log(`\n${c.b}5. 대시보드 반응${c.x}`);
const { before, after, planner } = now.dashboard;
const moved = Number(after.score) > 0 || after.weakCount > 0;
if (moved) ok(`예측 점수 ${before.score} → ${after.score} · ${after.sub} · 스트릭 ${after.streak}일 · 취약단원 ${after.weakCount}`);
else { bad(`학습해도 지표가 안 움직임 (점수 ${after.score}, 취약단원 ${after.weakCount})`); fail++; }
if (planner.time) ok(`학습 통계 공부시간 ${planner.time} · 평균 정착도 ${planner.settle ?? '—'}%`);
else { bad('학습 통계에 오늘 공부 시간이 안 뜸'); fail++; }

console.log();
if (fail) { console.log(`${c.r}${c.b}✗ 회귀 ${fail}건 — 이 단계는 되돌려야 합니다${c.x}\n`); process.exit(1); }
console.log(`${c.g}${c.b}✓ 통과 — 기능 변화 없음${c.x} ${c.d}(AI 호출 ${now.aiCallCount}회, 전부 목킹)${c.x}\n`);
