

const PREFIX = 'ailearn-drill:';
const key = (unitId) => PREFIX + unitId;

const INTERVAL = [45_000, 240_000, 900_000, 86_400_000, 259_200_000, 604_800_000];
const MASTER_BOX = 3;

function now() { return Date.now(); }
function load(unitId) {
  try {
    const raw = localStorage.getItem(key(unitId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function save(unitId, state) {
  try { localStorage.setItem(key(unitId), JSON.stringify(state)); } catch { }
}

function getDrill(unitId) { return unitId ? load(unitId) : null; }
export function hasDrill(unitId) { const s = getDrill(unitId); return !!(s && s.order && s.order.length); }

export function initDrill(unitId, cards, { merge = true } = {}) {
  const prev = (merge && load(unitId)) || { cards: {}, order: [], created: now() };
  const t = now();
  const seenQ = new Set(Object.values(prev.cards).map((c) => norm(c.q)));
  let n = prev.order.length;
  (cards || []).forEach((c) => {
    const q = String(c.q || '').trim();
    const a = String(c.a || '').trim();
    if (!q || !a) return;
    if (seenQ.has(norm(q))) return;
    seenQ.add(norm(q));
    const id = 'c' + (n++);
    prev.cards[id] = { id, q, a, box: 0, due: 0, seen: 0, correct: 0, wrong: 0 };
    prev.order.push(id);
  });
  prev.updated = t;
  save(unitId, prev);
  return prev;
}

const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

export function pickNext(unitId, exceptId = null) {
  const s = load(unitId);
  if (!s || !s.order.length) return null;
  const t = now();
  const arr = s.order.map((id) => s.cards[id]).filter(Boolean);
  const cmp = (a, b) => (a.due - b.due) || (a.box - b.box) || (a.seen - b.seen);
  const dueList = arr.filter((c) => c.due <= t && c.id !== exceptId).sort(cmp);
  if (dueList.length) return dueList[0];
  const notMastered = arr.filter((c) => c.box < MASTER_BOX && c.id !== exceptId).sort(cmp);
  if (notMastered.length) return notMastered[0];
  return null;
}

export function allCards(unitId) {
  const s = load(unitId);
  if (!s || !s.order.length) return [];
  return s.order.map((id) => s.cards[id]).filter(Boolean);
}

export function grade(unitId, cardId, correct) {
  const s = load(unitId);
  if (!s || !s.cards[cardId]) return null;
  const c = s.cards[cardId];
  const t = now();
  c.seen += 1;
  if (correct) { c.correct += 1; c.box = Math.min(5, c.box + 1); }
  else { c.wrong += 1; c.box = 0; }
  c.due = t + INTERVAL[c.box];
  s.updated = t;
  save(unitId, s);
  return c;
}

export function snapshot(unitId) {
  const s = load(unitId);
  if (!s || !s.order.length) return null;
  const arr = s.order.map((id) => s.cards[id]).filter(Boolean);
  const total = arr.length;
  const mastered = arr.filter((c) => c.box >= MASTER_BOX).length;
  const learning = arr.filter((c) => c.seen > 0 && c.box < MASTER_BOX).length;
  const fresh = arr.filter((c) => c.seen === 0).length;
  const attempts = arr.reduce((n, c) => n + c.seen, 0);
  const correct = arr.reduce((n, c) => n + c.correct, 0);
  const accuracy = attempts ? correct / attempts : 0;
  const boxes = [0, 0, 0, 0, 0, 0];
  arr.forEach((c) => { boxes[c.box] = (boxes[c.box] || 0) + 1; });
  const t = now();
  const dueNow = arr.filter((c) => c.due <= t).length;
  const coverage = total
    ? Math.min(1, arr.reduce((n, c) => n + Math.min(c.box, MASTER_BOX), 0) / (total * MASTER_BOX))
    : 0;
  const weak = arr.filter((c) => c.wrong > 0 && c.box < MASTER_BOX)
    .sort((a, b) => (b.wrong - a.wrong) || (a.box - b.box))
    .slice(0, 5)
    .map((c) => ({ q: c.q, wrong: c.wrong, box: c.box }));
  return { total, mastered, learning, fresh, attempts, correct, accuracy, coverage, boxes, dueNow, weak, updated: s.updated };
}

export { MASTER_BOX };
