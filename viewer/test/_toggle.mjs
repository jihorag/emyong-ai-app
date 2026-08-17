import { chromium } from 'playwright-core';
const DIR = '/private/tmp/claude-501/-Users-hanjiho-Documents------2/390669f3-de7b-486a-9a1b-e35faf92d581/scratchpad';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await b.newContext({ viewport: { width: 420, height: 940 }, deviceScaleFactor: 2 })).newPage();
const errs = []; let api = 0;
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)));
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
page.on('request', (r) => { if (/\/api\/ai/.test(r.url())) api++; });
page.on('dialog', (d) => d.accept());

const snap = () => page.evaluate(() => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k === 'profile' || k === 'quiz-studytime-v1' || k.startsWith('ailearn-')) o[k] = localStorage.getItem(k);
  }
  return o;
});

await page.goto('http://localhost:4183/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /좋아요, 시작할게요/ }).click();
await page.locator('input[type="text"]').fill('진짜사용자');
await page.getByRole('button', { name: /초수 \(교대 4학년\)/ }).click();
await page.getByRole('button', { name: '다음', exact: true }).click();
await page.getByRole('button', { name: '다음', exact: true }).click();
await page.getByRole('button', { name: '부산', exact: true }).click();
await page.getByRole('button', { name: /시작하기/ }).click();
await page.waitForTimeout(1800);
await page.evaluate(() => localStorage.setItem('ailearn-byok', JSON.stringify('sk-ant-realkey-xyz')));
const before = await snap();
console.log('1) 실사용 상태 키:', Object.keys(before).length, '· 이름:', JSON.parse(before.profile).name);

await page.evaluate(() => { window.location.hash = '#/home'; });
await page.waitForTimeout(600);
await page.getByRole('button', { name: '설정' }).first().click();
await page.waitForTimeout(900);
await page.getByRole('switch', { name: '데모 모드' }).click();
await page.waitForTimeout(5000);
await page.evaluate(() => { window.location.hash = '#/home'; });
await page.waitForTimeout(2000);
const inDemo = await snap();
console.log('2) 데모 ON — 이름:', JSON.parse(inDemo.profile).name, '· 키 수:', Object.keys(inDemo).length,
            '· 배지:', (await page.getByRole('button', { name: '데모 모드' }).count()) > 0,
            '· API키 남음:', 'ailearn-byok' in inDemo);
await page.screenshot({ path: `${DIR}/t1-on.png` });

await page.getByRole('button', { name: '데모 모드' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: '데모 끄고 원래 기록으로' }).click();
await page.waitForTimeout(3000);
const after = await snap();
const same = JSON.stringify(before) === JSON.stringify(after);
console.log('3) 데모 OFF — 이름:', JSON.parse(after.profile).name, '· 원래 상태와 완전 일치:', same);
if (!same) {
  const bk = Object.keys(before), ak = Object.keys(after);
  console.log('   차이 — 사라짐:', bk.filter(k => !ak.includes(k)), '생김:', ak.filter(k => !bk.includes(k)));
  console.log('   값 다른 키:', bk.filter(k => ak.includes(k) && before[k] !== after[k]));
}
console.log('   배지 사라짐:', (await page.getByRole('button', { name: '데모 모드' }).count()) === 0);
console.log('   백업 잔여:', await page.evaluate(() => localStorage.getItem('demo-backup-v1') != null));

await page.goto('http://localhost:4183/?demo=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
console.log('4) ?demo=1 링크 — 데모 켜짐:', await page.evaluate(() => localStorage.getItem('demo-mode') === '1'));
await page.goto('http://localhost:4183/?demo=0', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const back = await snap();
console.log('5) ?demo=0 링크 — 원래 이름:', JSON.parse(back.profile).name, '· 완전 일치:', JSON.stringify(before) === JSON.stringify(back));
console.log('콘솔 에러:', errs.length ? errs : '없음', '· 실제 /api/ai 요청:', api);
await b.close();
