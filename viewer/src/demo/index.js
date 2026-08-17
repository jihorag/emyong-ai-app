import { seedDemo } from './seed';
import { installMockAi } from './mockAi';

// ⚠ 시연 기간이라 기본값이 켜짐이다. 끄려면 설정에서 끄거나 주소에 ?demo=0 을 붙인다.
const FLAG = 'demo-mode';
const SEEDED = 'demo-seeded';
const BACKUP = 'demo-backup-v1';

const isAppData = (k) => k === 'profile' || k === 'quiz-studytime-v1' || k.startsWith('ailearn-');

export function isDemoOn() {
  try { return (localStorage.getItem(FLAG) ?? '1') === '1'; } catch { return true; }
}

const isSeeded = () => { try { return localStorage.getItem(SEEDED) === '1'; } catch { return false; } };

function appDataKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && isAppData(k)) out.push(k);
    }
  } catch { }
  return out;
}

function wipeAppData() {
  appDataKeys().forEach((k) => { try { localStorage.removeItem(k); } catch { } });
}

export async function enterDemo() {
  if (isSeeded()) return;
  const backup = {};
  appDataKeys().forEach((k) => { backup[k] = localStorage.getItem(k); });
  try { localStorage.setItem(BACKUP, JSON.stringify(backup)); } catch { }
  wipeAppData();
  try {
    localStorage.setItem(FLAG, '1');
    localStorage.setItem(SEEDED, '1');
  } catch { }
  await seedDemo();
}

export async function reseedDemo() {
  if (!isDemoOn()) return;
  wipeAppData();
  await seedDemo();
}

export function emptyDemo() {
  if (!isDemoOn()) return;
  wipeAppData();
}

export function exitDemo() {
  const raw = (() => { try { return localStorage.getItem(BACKUP); } catch { return null; } })();
  wipeAppData();
  if (raw) {
    try {
      Object.entries(JSON.parse(raw)).forEach(([k, v]) => {
        if (typeof v === 'string') localStorage.setItem(k, v);
      });
    } catch { }
  }
  try {
    localStorage.removeItem(BACKUP);
    localStorage.removeItem(SEEDED);
    localStorage.setItem(FLAG, '0');
  } catch { }
}

export function hasBackup() {
  try { return localStorage.getItem(BACKUP) != null; } catch { return false; }
}

export async function bootDemo() {
  let asked = null;
  try {
    const q = new URLSearchParams(window.location.search).get('demo');
    if (q === '1' || q === '0') asked = q === '1';
  } catch { }

  if (asked === true) { try { localStorage.setItem(FLAG, '1'); } catch { } }
  if (asked === false && isDemoOn()) exitDemo();
  if (isDemoOn()) {
    await enterDemo();
    installMockAi();
  }
  return isDemoOn();
}
