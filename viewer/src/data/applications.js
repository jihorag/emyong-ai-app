// ⚠ 문항은 AI가 만들지 않는다. 상황·채점요소·모범답안은 검수를 거쳐

import { KEY, addWrongNote, recordGrade, markActiveToday, updateChapterMastery } from './stores/learningStore';

const ATTEMPTS = 'ailearn-apply-attempts';

const _cache = new Map();

export async function loadApplications(unitId) {
  if (!unitId) return [];
  if (_cache.has(unitId)) return _cache.get(unitId);
  let items = [];
  try {
    const r = await fetch(`/data/applications/${encodeURIComponent(unitId)}.json`);
    if (r.ok) {
      const raw = await r.json();
      items = (raw.items || []).filter(validItem);
    }
  } catch { }
  _cache.set(unitId, items);
  return items;
}

function validItem(it) {
  if (!it?.id || !it.situation || !it.question) return false;
  if (!Array.isArray(it.rubric) || !it.rubric.length) return false;
  return it.rubric.every((r) => r.id && r.label && Number.isFinite(r.points));
}

export const isReviewed = (item) => item?.status === 'approved' && !!item?.reviewedAt;

export const totalPoints = (item) => (item?.rubric || []).reduce((n, r) => n + r.points, 0);

function loadAll() {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS) || '[]'); } catch { return []; }
}
function saveAll(arr) {
  try { localStorage.setItem(ATTEMPTS, JSON.stringify(arr.slice(0, 500))); } catch { }
}

export function getAttempts(unitId) {
  const all = loadAll();
  return unitId ? all.filter((a) => a.unitId === unitId) : all;
}

export function saveAttempt({ item, answerText, marks, scored, total, needsReview }) {
  const attempt = {
    itemId: item.id,
    unitId: item.unitId,
    answerText,
    createdAt: new Date().toISOString(),
    marks: marks || [],
    scored: needsReview ? null : scored,
    total,
    needsReview: !!needsReview,
  };
  saveAll([attempt, ...loadAll()]);

  if (!needsReview) {
    try {
      markActiveToday();
      recordGrade(item.unitId, scored >= total);
      updateChapterMastery(item.unitId, { applyScore: total ? scored / total : 0 });
    } catch { }
  }
  return attempt;
}

export function saveToWrongNote({ item, unit, answerText, marks }) {
  const missed = (marks || []).flatMap((m) => m.missedKeywords || []).filter(Boolean);
  const text = [
    `[상황] ${item.situation}`,
    `[문제] ${item.question}`,
    `[내 답안] ${answerText || '(작성 안 함)'}`,
    missed.length ? `[빠진 키워드] ${[...new Set(missed)].join(', ')}` : '',
    `[모범답안] ${item.modelAnswer || ''}`,
    item.source ? `[출처] ${item.source}` : '',
  ].filter(Boolean).join('\n\n');

  return addWrongNote({
    unitId: item.unitId,
    unitTitle: unit?.title || '',
    path: unit?.path || [],
    level: 'apply',
    text,
  });
}

export { KEY };
