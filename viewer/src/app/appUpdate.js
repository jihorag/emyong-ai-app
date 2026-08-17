import { registerSW } from 'virtual:pwa-register';

const CHECK_MS = 3 * 60 * 1000;
const RELOADED_KEY = 'ailearn-reloaded-build';

let busy = false;

function reloadOnce() {
  if (busy) return;
  busy = true;
  window.location.reload();
}

// ⚠ 최후 수단. 캐시를 통째로 지우고 워커까지 해제해야 아이폰 홈화면 앱이 새 화면을 받는다.
async function purgeAndReload(buildId) {
  if (busy) return;
  busy = true;
  try { sessionStorage.setItem(RELOADED_KEY, buildId); } catch { }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch { }
  window.location.reload();
}

async function checkVersion() {
  if (busy) return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { buildId } = await res.json();
    if (!buildId || buildId === __BUILD_ID__) return;
    if (sessionStorage.getItem(RELOADED_KEY) === buildId) return;
    await purgeAndReload(buildId);
  } catch { }
}

export function startUpdateWatch() {
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        if (reg) setInterval(() => { reg.update().catch(() => {}); }, CHECK_MS);
      },
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) reloadOnce();
    });
  }

  checkVersion();
  setInterval(checkVersion, CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkVersion();
  });
  window.addEventListener('focus', checkVersion);
  window.addEventListener('online', checkVersion);
  window.addEventListener('pageshow', checkVersion);
}
