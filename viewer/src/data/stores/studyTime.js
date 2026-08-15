
const KEY = 'quiz-studytime-v1';

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const loadStudyTime = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
};
const save = (obj) => {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { }
};

export const addStudySeconds = (category, secs, subjectId, unit) => {
  if (!category || !(secs > 0)) return;
  const all = loadStudyTime();
  const k = dayKey();
  const day = all[k] || { ai: 0, quiz: 0 };
  day[category] = Math.round((day[category] || 0) + secs);
  if (subjectId) {
    day.subjects = day.subjects || {};
    const sj = day.subjects[subjectId] || { secs: 0, units: {} };
    sj.secs = Math.round(sj.secs + secs);
    if (unit) sj.units[unit] = Math.round((sj.units[unit] || 0) + secs);
    day.subjects[subjectId] = sj;
  }
  const d = new Date();
  const slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / 10);
  day.slots = day.slots || {};
  const sl = day.slots[slot] || { ai: 0, quiz: 0 };
  sl[category] = Math.min(600, Math.round((sl[category] || 0) + secs));
  day.slots[slot] = sl;
  all[k] = day;
  save(all);
};

export const getDaySlots = (key) => loadStudyTime()[key]?.slots || {};

export const getDaySubjects = (key) => loadStudyTime()[key]?.subjects || {};

export const getDayStudyTime = (key) => {
  const d = loadStudyTime()[key];
  return { ai: d?.ai || 0, quiz: d?.quiz || 0 };
};
export const getDayTotal = (key) => {
  const { ai, quiz } = getDayStudyTime(key);
  return ai + quiz;
};
