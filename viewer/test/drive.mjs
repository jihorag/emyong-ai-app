// 앱 구동 드라이버 — 실제 사용자 흐름을 브라우저로 통과시키고 관측값을 수집한다.
//
// 수집하는 것 (= 회귀 판정의 근거):
//   screens        각 화면이 기대한 요소를 렌더했는가
//   storageKeys    localStorage 키 목록 — 데이터 계층을 옮겨도 바뀌면 안 된다
//   prompts        AI에 실제로 나간 system 프롬프트 — 프롬프트를 옮겨도 바뀌면 안 된다
//   consoleErrors  콘솔 에러 (0이어야 함)
//   dashboard      학습 후 대시보드 수치 — 기능이 살아 있는지의 최종 증거
//
// 이 파일은 "무엇을 관측하는가"만 담당한다. 판정은 verify.mjs가 한다.

import { installAiMock, DRILL_CARDS } from './mock-ai.mjs';

const IGNORABLE = [
  /Failed to load resource.*\/api\/ai/,   // 목이 붙기 전 첫 요청
  /Download the React DevTools/,
];

export async function drive(chromium, baseUrl, { screenshotDir = null } = {}) {
  // 로컬은 설치된 Chrome을 그대로 쓴다(브라우저 별도 다운로드 회피).
  // CI엔 Chrome이 없으므로 PLAYWRIGHT_CHANNEL=chromium 으로 Playwright 번들을 쓰게 한다.
  const channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome';
  const browser = await chromium.launch(channel === 'chromium' ? { headless: true } : { channel, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 940 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORABLE.some((re) => re.test(t))) consoleErrors.push(t.slice(0, 200));
  });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('dialog', (d) => d.accept());

  const { calls } = await installAiMock(page);
  const screens = {};
  const shot = async (name) => {
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${name}.png` });
  };
  const seen = async (name, check) => { screens[name] = await check(); };

  // ⚠ 데모 모드가 기본 켜짐이다. 회귀 검증은 실제 앱을 봐야 하므로 꺼진 상태로 시작한다.
  await page.goto(`${baseUrl}?demo=0`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('demo-mode', '0'); });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // ── 온보딩 ────────────────────────────────────────────────
  await seen('onboarding', async () => !!(await page.getByRole('button', { name: /좋아요, 시작할게요/ }).count()));
  await page.getByRole('button', { name: /좋아요, 시작할게요/ }).click();
  await page.locator('input[type="text"]').fill('검증');
  await page.getByRole('button', { name: /초수 \(교대 4학년\)/ }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '부산', exact: true }).click();
  await page.getByRole('button', { name: /시작하기/ }).click();
  await page.waitForTimeout(1800);

  const goTab = async (hash) => {
    await page.evaluate(() => { window.location.hash = '#/home'; });
    await page.waitForTimeout(400);
    await page.evaluate((h) => { window.location.hash = h; }, hash);
    await page.waitForTimeout(1000);
  };

  // 예측 점수 블록은 홈 개편으로 '바로가기 › 내 실력' 안으로 들어갔다.
  // 들어가서 읽고 다시 나온다.
  const readHome = async () => {
    await page.getByRole('button', { name: /내 실력/ }).click();
    await page.waitForTimeout(1100);
    const v = await readSkill();
    await page.getByRole('button', { name: '뒤로' }).first().click();
    await page.waitForTimeout(700);
    return v;
  };

  const readSkill = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('div')];
    const label = all.find((d) => d.textContent.trim() === '예측 점수' && !d.children.length);
    const box = label?.parentElement;
    const nums = box ? [...box.children].map((c) => c.textContent.trim()) : [];
    const weak = [...document.querySelectorAll('section')].find((s) => /취약한 단원/.test(s.textContent));
    return {
      score: nums[1] ?? null,
      sub: nums[2] ?? null,
      weakCount: weak ? weak.querySelectorAll('button').length : 0,
      streak: (document.body.innerText.match(/🔥\s*(\d+)일 연속/) || [])[1] ?? null,
    };
  });

  await goTab('#/home');
  const homeBefore = await readHome();
  await seen('home.skill', async () => {
    await page.getByRole('button', { name: /내 실력/ }).click();
    await page.waitForTimeout(1000);
    const ok = (await page.getByText('과목별 실력').count()) > 0;
    await page.getByRole('button', { name: '뒤로' }).first().click();
    await page.waitForTimeout(600);
    return ok;
  });
  await seen('home', async () => !!(await page.getByText('바로가기').count()));
  await shot('01-home-before');

  // 노트 → 기억 확인(스제트 카드 생성·채점)
  await goTab('#/learn');
  await seen('learn.subjects', async () => (await page.getByText('과목별 학습').count()) > 0);
  await page.getByRole('button', { name: /수학/ }).first().click();
  await page.waitForTimeout(1600);
  await seen('learn.units', async () => (await page.getByRole('button', { name: /베르트하이머/ }).count()) > 0);

  await page.getByRole('button', { name: /베르트하이머/ }).first().click();
  await page.waitForTimeout(1400);
  await seen('learn.unitStages', async () => (await page.getByText('나의 학습 상황').count()) > 0);
  await shot('05a-stages');
  await page.getByRole('button', { name: /개념 읽기/ }).click();
  await page.waitForTimeout(1700);
  await seen('learn.note', async () => (await page.getByText('단권화 노트').count()) > 0);
  await shot('02-note');

  await page.getByRole('button', { name: /이 단원 기억 확인하기/ }).click();
  await page.waitForTimeout(2600);
  await seen('learn.recallIntro', async () => (await page.getByText(/전에 공부한 적 있나요/).count()) > 0);
  await page.getByRole('button', { name: /여러 번 봤어요/ }).click();
  await page.waitForTimeout(1400);

  const recallInput = page.locator('input[placeholder="답을 입력하세요"]');
  for (let i = 0; i < 6; i++) {
    if (!(await recallInput.count()) || !(await recallInput.isEnabled().catch(() => false))) break;
    const q = await page.evaluate(() => {
      const s = [...document.querySelectorAll('span')].map((x) => x.textContent.trim());
      return s.reverse().find((x) => x.length > 8 && (x.includes('____') || x.endsWith('?') || x.includes('이것은'))) || '';
    });
    const hit = DRILL_CARDS.find(([cq]) => q.includes(cq.slice(0, 12)));
    await recallInput.fill(hit ? hit[1] : '통찰');
    await page.getByRole('button', { name: '전송' }).click();
    await page.waitForTimeout(900);
  }
  await seen('learn.recall', async () => (await page.getByText(/정착도 [●○]+/).count()) > 0);
  await shot('03-recall');

  // 재진입 — 덱과 사전지식이 이미 있는 단원. 입력창이 잠기면 안 된다.
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /기억 확인/ }).click();
  await page.waitForTimeout(2600);
  await seen('learn.recallReturn', async () => {
    const box = page.locator('input[placeholder="답을 입력하세요"]');
    return (await box.count()) > 0 && (await box.isEnabled());
  });

  // 스제트 연습 — AI를 안 쓴다(카드는 노트에서 이미 만들어져 있다)
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /스제트 연습/ }).click();
  await page.waitForTimeout(1400);
  await seen('learn.drill', async () => (await page.getByText('탭하면 답이 보여요').count()) > 0);
  await shot('03a-drill');
  await page.locator('button').filter({ hasText: '탭하면 답이 보여요' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '외웠어요' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '카드 목록 보기' }).click();
  await page.waitForTimeout(800);
  await seen('learn.drillList', async () => (await page.getByRole('button', { name: '아직 못 외운 것' }).count()) > 0);
  await shot('03b-drill-list');
  await page.getByRole('button', { name: '아직 못 외운 것' }).click();
  await page.waitForTimeout(500);

  // ── 변형문제 (자체 탭 없음 — 전체 학습 › 단원 › 문제 풀기) ──
  await goTab('#/learn');
  await page.getByRole('button', { name: /수학/ }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /베르트하이머/ }).first().click();
  await page.waitForTimeout(1400);

  await page.getByRole('button', { name: /문제 풀기/ }).click();
  await page.waitForTimeout(1600);
  await seen('variant.problem', async () => (await page.getByRole('button', { name: /채점 루브릭/ }).count()) > 0);
  await page.getByRole('button', { name: /채점 루브릭/ }).click();
  await page.waitForTimeout(700);
  await shot('05-variant');
  // '맞음 · 다음 문제' → AI 출제 프롬프트 포착
  await page.getByRole('button', { name: /맞음/ }).click();
  await page.waitForTimeout(1800);
  // 다음 문제는 오답 처리해 오답노트를 실제로 만든다.
  // (예전엔 빈 목록을 배너로 열었다 — 저장 경로가 검증되지 않았다.)
  await page.getByRole('button', { name: /채점 루브릭/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /오답노트 저장/ }).click();
  await page.waitForTimeout(1800);

  // 오답노트 — 복습 탭으로 옮겨졌다
  await goTab('#/recall');
  await seen('recall', async () => (await page.getByText('오답노트').count()) > 0);
  await shot('05b-recall');
  await page.getByRole('button', { name: /틀린 문제 \d+개 보기/ }).click();
  await page.waitForTimeout(1200);
  await seen('recall.wrongNote', async () => (await page.getByText(/틀리거나 어려웠던 문제/).count()) > 0);

  // ── 개념 활용 (검수 문항이 있는 부르너 단원) ──────────────
  await goTab('#/learn');
  await page.getByRole('button', { name: /수학/ }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /부르너/ }).first().click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: /개념 활용/ }).click();
  await page.waitForTimeout(1300);
  await page.locator('textarea').fill('활동적 표현입니다. 구체물을 직접 조작했기 때문입니다.');
  await page.getByRole('button', { name: '채점하기' }).click();
  await page.waitForTimeout(1700);
  await seen('learn.apply', async () => (await page.getByText(/\d+ \/ \d+ 점/).count()) > 0);
  await shot('05d-apply');

  // 궁금한 것 묻기 — 노트 섹션에 근거해 답한다(추천 질문도 노트에서 뽑는다)
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /궁금한 것 묻기/ }).click();
  await page.waitForTimeout(1500);
  await seen('learn.ask', async () => (await page.getByText(/궁금한 걸 물어보세요/).count()) > 0);
  await shot('05e-ask');
  await page.locator('button').filter({ hasText: '초등 수업 예시 알려줘' }).click();
  await page.waitForTimeout(1800);
  await seen('learn.askAnswer', async () => (await page.getByText(/근거: .*부르너 단원/).count()) > 0);
  await shot('05f-ask-answer');

  // ── 논술채점 (전체 학습 상단 진입 · 1×1 PNG로 비전 경로 통과) ──
  await goTab('#/learn');
  await page.getByRole('button', { name: '논술', exact: true }).click();
  await page.waitForTimeout(900);
  await seen('essay', async () => (await page.getByText('채점 기준 사진').count()) > 0);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const files = await page.locator('input[type="file"]').all();
  if (files.length) {
    await files[0].setInputFiles({ name: 'rubric.png', mimeType: 'image/png', buffer: png });
    await page.waitForTimeout(900);
    await page.locator('textarea').fill('검증용 답안 텍스트입니다.');
    await page.getByRole('button', { name: /이 기준으로 채점하기/ }).click();
    await page.waitForTimeout(2200);
  }
  await shot('06-essay');

  // ── 학습 통계 · 설정 ──────────────────────────────────────
  await goTab('#/stats');
  const planner = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      settle: (t.match(/(\d+)%\s*\n?\s*평균 정착도/) || [])[1] || null,
      time: (t.match(/오늘 공부 시간\s*\n([\d:]+)/) || [])[1] || null,
    };
  });
  await seen('stats', async () => (await page.getByText('오늘 공부 시간').count()) > 0);
  await shot('07-planner');

  await goTab('#/home');
  await page.getByRole('button', { name: '설정' }).first().click();
  await page.waitForTimeout(1000);
  await seen('settings', async () => (await page.getByText(/프로필 다시 설정|AI 모델/).count()) > 0);
  await shot('08-settings');

  // ── 최종 관측 ─────────────────────────────────────────────
  await goTab('#/home');
  const homeAfter = await readHome();
  await shot('09-home-after');

  // ── 데모 모드 켜고 끄기 ────────────────────────────────────
  // ⚠ 끈 뒤 실제 학습 기록이 한 바이트도 다르면 안 된다. 사용자 데이터가 걸려 있다.
  const appData = () => page.evaluate(() => {
    const o = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k === 'profile' || k === 'quiz-studytime-v1' || k.startsWith('ailearn-')) o[k] = localStorage.getItem(k);
    }
    return o;
  });
  const realData = await appData();

  await goTab('#/home');
  await page.getByRole('button', { name: '설정' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('switch', { name: '데모 모드' }).click();
  await page.waitForTimeout(6000);
  await seen('demo.on', async () => {
    const seeded = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('profile') || '{}').name; } catch { return null; }
    });
    const badge = await page.getByRole('button', { name: '데모 모드' }).count();
    return badge > 0 && seeded === '김임용';
  });
  await shot('10-demo-on');

  // 데모 데이터는 전 과목에 걸쳐 있어 레이더가 실제로 그려지는 유일한 구간이다
  await goTab('#/stats');
  await seen('stats.radar', async () => {
    const polys = await page.evaluate(() => document.querySelectorAll('svg polygon').length);
    const avg = await page.getByText('평균 정착도').count();
    return polys >= 7 && avg > 0;
  });
  await shot('10b-demo-stats');

  await goTab('#/learn');
  await seen('demo.guide', async () => (await page.getByText(/현재는 수학 과목만 학습이 가능해요/).count()) > 0);
  await shot('10c-demo-guide');

  await page.getByRole('button', { name: '데모 모드' }).last().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /데모 끄고 원래 기록으로/ }).click();
  await page.waitForTimeout(3500);
  const restored = await appData();
  await seen('demo.restored', async () => JSON.stringify(restored) === JSON.stringify(realData));
  await seen('demo.off', async () => (await page.getByRole('button', { name: '데모 모드' }).count()) === 0);

  const storageKeys = await page.evaluate(() =>
    Object.keys(localStorage)
      // 단원 id가 섞인 키는 접두사만 남겨 비교(콘텐츠 변경에 흔들리지 않도록)
      .map((k) => k.replace(/^(ailearn-(?:drill|room|answers)):.+$/, '$1:*')
                   .replace(/^(ailearn-conversations):.+$/, '$1:*'))
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort());

  await browser.close();

  return {
    screens,
    storageKeys,
    // 종류별 '첫' 호출을 기준으로 삼는다 — 마지막 호출은 드릴 카드 순서에 따라 흔들린다.
    prompts: Object.fromEntries(
      [...calls.reduce((m, c) => (m.has(c.kind) ? m : m.set(c.kind, c.system)), new Map())].sort(),
    ),
    userMessages: Object.fromEntries(
      [...calls.reduce((m, c) => (m.has(c.kind) ? m : m.set(c.kind, c.user)), new Map())].sort(),
    ),
    promptKinds: [...new Set(calls.map((c) => c.kind))].sort(),
    aiCallCount: calls.length,
    consoleErrors,
    dashboard: { before: homeBefore, after: homeAfter, planner },
  };
}
