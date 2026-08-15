// ⚠ 여기 정의된 localStorage 키는 곧 향후 서버 DB 스키마다. 그리고 이미 앱을 쓰고 있는

export const KEY = {
  byok: 'ailearn-byok',
  byokOpenai: 'ailearn-byok-openai',
  byokGoogle: 'ailearn-byok-google',
  byokMoonshot: 'ailearn-byok-moonshot',
  baseUrls: 'ailearn-base-urls',
  prefs: 'ailearn-prefs',
  mastery: 'ailearn-mastery',
  wrongNote: 'ailearn-wrongnote',
  streak: 'ailearn-streak',
  vizUsage: 'ailearn-viz-usage',
  unitIntro: 'ailearn-unit-intro',
  answers: (unitId) => `ailearn-answers:${unitId}`,
};

const DEFAULT_PREFS = {
  daily_cap: 500,
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1200,
  reasoning_effort: 'minimal',
  verbosity: 'high',
  hide_handover_hint: false,
};

const MASTERY_DEFAULT = {
  coverage: 0, accuracy: 0, status: 'not_started',
  last_studied: null, next_review: null, srs_box: 0,
  attempted: 0, correct: 0,
};

const SRS_LADDER = [1, 3, 7, 16, 35, 70];
const DAY_MS = 86400000;

function lsGet(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return def;
    if (typeof def === 'object' && def !== null) return JSON.parse(raw);
    if (typeof def === 'number') {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : def;
    }
    return raw;
  } catch { return def; }
}

function lsSet(key, val) {
  try {
    if (val == null) { localStorage.removeItem(key); return; }
    localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
  } catch { }
}

const pad = (n) => String(n).padStart(2, '0');
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getByok() { return lsGet(KEY.byok, ''); }
export function setByok(k) { lsSet(KEY.byok, k || null); }

export function getApiKey(provider) {
  if (provider === 'openai') return lsGet(KEY.byokOpenai, '');
  if (provider === 'google') return lsGet(KEY.byokGoogle, '');
  if (provider === 'moonshot') return lsGet(KEY.byokMoonshot, '');
  return lsGet(KEY.byok, '');
}
export function setApiKey(provider, k) {
  if (provider === 'openai') return lsSet(KEY.byokOpenai, k || null);
  if (provider === 'google') return lsSet(KEY.byokGoogle, k || null);
  if (provider === 'moonshot') return lsSet(KEY.byokMoonshot, k || null);
  return lsSet(KEY.byok, k || null);
}

export function getBaseUrls() { return lsGet(KEY.baseUrls, {}); }
export function setBaseUrl(provider, url) {
  const cur = getBaseUrls();
  cur[provider] = url || undefined;
  lsSet(KEY.baseUrls, cur);
}

const MODEL_ID_MIGRATE = {
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'gemini-3.1-flash': 'gemini-3.1-flash-lite',
};
export function getPrefs() {
  const merged = { ...DEFAULT_PREFS, ...lsGet(KEY.prefs, {}) };
  if (merged.model && MODEL_ID_MIGRATE[merged.model]) {
    merged.model = MODEL_ID_MIGRATE[merged.model];
    lsSet(KEY.prefs, merged);
  }
  return merged;
}
export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  lsSet(KEY.prefs, next);
  return next;
}

export function getMastery() { return lsGet(KEY.mastery, {}); }

export function getChapterMastery(unitId) {
  const all = getMastery();
  return { ...MASTERY_DEFAULT, ...(all[unitId] || {}) };
}

export function updateChapterMastery(unitId, patch) {
  const all = getMastery();
  const prev = { ...MASTERY_DEFAULT, ...(all[unitId] || {}) };
  const next = { ...prev, ...patch, last_studied: new Date().toISOString() };
  if (next.coverage >= 0.95 && next.accuracy >= 0.8) next.status = 'mastered';
  else if (next.coverage > 0) next.status = 'in_progress';
  const now = Date.now();
  if (next.status === 'mastered') {
    const box = Math.min(SRS_LADDER.length - 1, (prev.srs_box || 0) + 1);
    next.srs_box = box;
    next.next_review = new Date(now + SRS_LADDER[box] * DAY_MS).toISOString();
  } else if (next.status === 'in_progress') {
    next.srs_box = 0;
    next.next_review = new Date(now + SRS_LADDER[0] * DAY_MS).toISOString();
  }
  all[unitId] = next;
  lsSet(KEY.mastery, all);
  return next;
}

export function recordGrade(unitId, isCorrect) {
  const prev = getChapterMastery(unitId);
  const attempted = (prev.attempted || 0) + 1;
  const correct = (prev.correct || 0) + (isCorrect ? 1 : 0);
  const patch = { attempted, correct, accuracy: attempted > 0 ? correct / attempted : 0 };
  if (!isCorrect && prev.srs_box > 0) patch.srs_box = Math.max(0, prev.srs_box - 1);
  return updateChapterMastery(unitId, patch);
}

export function getAllAnswerHistories() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('ailearn-answers:')) continue;
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(arr) && arr.length) out.push({ leafId: k.slice('ailearn-answers:'.length), history: arr });
    }
  } catch { }
  return out;
}

export function getWrongNotes() { return lsGet(KEY.wrongNote, []); }
export function addWrongNote(item) {
  const arr = getWrongNotes();
  if (item.text && arr.some((w) => w.text === item.text)) return arr;
  arr.unshift({ id: 'wn_' + Date.now() + '_' + Math.floor(Math.random() * 9999), ts: new Date().toISOString(), ...item });
  while (arr.length > 300) arr.pop();
  lsSet(KEY.wrongNote, arr);
  return arr;
}
export function removeWrongNote(id) {
  const arr = getWrongNotes().filter((w) => w.id !== id);
  lsSet(KEY.wrongNote, arr);
  return arr;
}

export function getUnitIntro(unitId) {
  return lsGet(KEY.unitIntro, {})[unitId] || null;
}
export function setUnitIntro(unitId, level) {
  const all = lsGet(KEY.unitIntro, {});
  all[unitId] = level;
  lsSet(KEY.unitIntro, all);
  return level;
}

export function incrementVizUsage(name, ok = true) {
  const all = lsGet(KEY.vizUsage, {});
  const cur = all[name] || { ok: 0, err: 0, last_ts: null };
  if (ok) cur.ok++; else cur.err++;
  cur.last_ts = new Date().toISOString();
  all[name] = cur;
  lsSet(KEY.vizUsage, all);
}

export function getStreak() {
  return lsGet(KEY.streak, { current: 0, longest: 0, last_active: null, active_dates: [] });
}

export function markActiveToday() {
  const today = todayKey();
  const s = getStreak();
  if (s.last_active === today) return s;
  const dates = new Set(s.active_dates || []);
  dates.add(today);
  const recent = Array.from(dates).sort().slice(-60);
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const cur = s.last_active === yesterday ? (s.current || 0) + 1 : 1;
  const next = { current: cur, longest: Math.max(s.longest || 0, cur), last_active: today, active_dates: recent };
  lsSet(KEY.streak, next);
  return next;
}

export function detectWeaknesses(masteryDict, allAnswerHistories, topN = 5) {
  const candidates = [];
  Object.entries(masteryDict || {}).forEach(([unitId, m]) => {
    if ((m.attempted || 0) >= 3 && (m.accuracy || 0) < 0.7) {
      candidates.push({
        leafId: unitId,
        weakness: (0.7 - (m.accuracy || 0)) * (m.attempted || 0),
        reason: `정답률 ${Math.round((m.accuracy || 0) * 100)}% (${m.attempted}회 풀이)`,
        kind: 'quiz',
      });
    }
  });
  (allAnswerHistories || []).forEach(({ leafId, history }) => {
    if (history.length < 2) return;
    const scores = history.map((h) => h.score / (h.max || 30)).filter((v) => !isNaN(v));
    if (!scores.length) return;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 0.7) {
      candidates.push({
        leafId,
        weakness: (0.7 - avg) * Math.min(scores.length, 5),
        reason: `답안 평균 ${Math.round(avg * 100)}% (${scores.length}회 작성)`,
        kind: 'answer',
      });
    }
  });
  candidates.sort((a, b) => b.weakness - a.weakness);
  return candidates.slice(0, topN);
}

export function resetLearningProgress() {
  const remove = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('ailearn-')) continue;
      if (k === KEY.byok || k === KEY.prefs) continue;
      remove.push(k);
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch { }
  return remove.length;
}
