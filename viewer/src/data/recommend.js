
import { getWrongNotes } from './stores/learningStore';
import { snapshot } from './stores/drillStore';

const DRILL_PREFIX = 'ailearn-drill:';

export function unitIdsWithDrill() {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRILL_PREFIX)) ids.push(k.slice(DRILL_PREFIX.length));
    }
  } catch { }
  return ids;
}

function indexUnits(leavesBySubject) {
  const map = new Map();
  Object.values(leavesBySubject || {}).forEach((units) => {
    (units || []).forEach((u) => map.set(u.id, u));
  });
  return map;
}

// ⚠ Math.random 금지. 들어올 때마다 카드가 바뀌면 '아까 그거'를 못 찾는다.
function dailyKey(unitId) {
  const s = `${new Date().toISOString().slice(0, 10)}|${unitId}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function getRecommendations(leavesBySubject, { limit = 3 } = {}) {
  const units = indexUnits(leavesBySubject);
  const picked = new Map();

  const add = (unitId, reason, tone, sort) => {
    if (!unitId || picked.has(unitId)) return;
    const unit = units.get(unitId);
    if (!unit) return;
    picked.set(unitId, { unit, reason, tone, sort });
  };

  getWrongNotes().forEach((w) => add(w.unitId, '틀린 문제가 있어요', 'danger', 0));

  const drills = unitIdsWithDrill()
    .map((id) => ({ id, snap: snapshot(id) }))
    .filter((x) => x.snap)
    .sort((a, b) => (b.snap.updated || 0) - (a.snap.updated || 0));

  drills.forEach(({ id, snap }) => {
    if (snap.dueNow > 0) add(id, '오늘 복습할 차례', 'brand', 1);
  });
  drills.forEach(({ id, snap }) => {
    if (snap.coverage < 1) add(id, '이어서 학습', 'neutral', 2);
  });

  if (picked.size < limit) {
    [...units.values()]
      .filter((u) => !picked.has(u.id) && (u.study_file || (u.cloze || []).length))
      .sort((a, b) => dailyKey(a.id) - dailyKey(b.id))
      .slice(0, limit - picked.size)
      .forEach((u) => picked.set(u.id, { unit: u, reason: '새로 시작하기', tone: 'neutral', sort: 3 }));
  }

  return [...picked.values()]
    .sort((a, b) => a.sort - b.sort)
    .slice(0, limit);
}

export function getRecentUnits(leavesBySubject, { limit = 3 } = {}) {
  const units = indexUnits(leavesBySubject);
  return unitIdsWithDrill()
    .map((id) => ({ unit: units.get(id), snap: snapshot(id) }))
    .filter((x) => x.unit && x.snap)
    .sort((a, b) => (b.snap.updated || 0) - (a.snap.updated || 0))
    .slice(0, limit)
    .map((x) => x.unit);
}

export function searchUnits(leavesBySubject, query, { limit = 20 } = {}) {
  const q = (query || '').trim().replace(/\s+/g, '');
  if (!q) return [];
  const hit = [];
  Object.values(leavesBySubject || {}).forEach((list) => {
    (list || []).forEach((u) => {
      const title = (u.title || '').replace(/\s+/g, '');
      if (title.includes(q)) hit.push({ u, exact: title === q, head: title.startsWith(q) });
    });
  });
  hit.sort((a, b) => (b.exact - a.exact) || (b.head - a.head) || a.u.title.localeCompare(b.u.title));
  return hit.slice(0, limit).map((x) => x.u);
}
