import { SUBJECTS } from '../data/subjects';
import { noteToCards } from '../data/drillCards';

const DAY = 86400000;
const MIN = 60000;

let _s = 20260817;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const initials = (s) => [...String(s)].map((ch) => {
  const c = ch.charCodeAt(0) - 0xac00;
  return c >= 0 && c <= 11171 ? String.fromCharCode(0x1100 + Math.floor(c / 588)) : ch;
}).join('');

function sectionFor(md, title) {
  const lines = String(md || '').split('\n');
  const heads = lines.map((l, i) => [i, l]).filter(([, l]) => /^##\s/.test(l));
  if (!heads.length) return String(md || '');
  let hit = heads.find(([, l]) => l.includes(title));
  if (!hit && title.length >= 3) {
    const loose = heads.filter(([, l]) => initials(l).includes(initials(title)));
    if (loose.length === 1) [hit] = loose;
  }
  if (!hit) return '';
  const next = heads.find(([i]) => i > hit[0]);
  return lines.slice(hit[0], next ? next[0] : lines.length).join('\n');
}

async function loadUnits() {
  const out = {};
  await Promise.all(SUBJECTS.map(async (s) => {
    try {
      const r = await fetch(`/data/taxonomy/${s.id}.json`);
      if (!r.ok) return;
      const d = await r.json();
      out[s.id] = (d.areas || []).flatMap((a) => (a.units || [])
        .map((u) => ({ ...u, subject: s.id, area: a.name })));
    } catch { }
  }));
  return out;
}

async function seedDecks(mathUnits) {
  const notes = new Map();
  const withNote = mathUnits.filter((u) => u.study_file).slice(0, 14);
  const decks = [];

  for (const u of withNote) {
    if (!notes.has(u.study_file)) {
      try {
        const r = await fetch(`/data/study/math/${encodeURIComponent(u.study_file)}`);
        notes.set(u.study_file, r.ok ? await r.text() : '');
      } catch { notes.set(u.study_file, ''); }
    }
    const section = sectionFor(notes.get(u.study_file), u.title);
    const cards = noteToCards(`## ${u.title}\n${section.split('\n').slice(1).join('\n')}`, u.title);
    if (cards.length < 4) continue;

    const state = { cards: {}, order: [], created: Date.now() - 18 * DAY, updated: Date.now() - between(0, 3) * DAY };
    cards.slice(0, between(9, 18)).forEach((c, i) => {
      const id = 'c' + i;
      const roll = rnd();
      const box = roll < 0.34 ? between(3, 5) : roll < 0.78 ? between(1, 2) : 0;
      const seen = box === 0 ? between(0, 1) : box + between(0, 3);
      const correct = Math.max(0, seen - (box >= 3 ? between(0, 1) : between(1, 2)));
      state.cards[id] = {
        id, q: c.q, a: c.a, box, seen, correct,
        wrong: Math.max(0, seen - correct),
        due: Date.now() + (rnd() < 0.1 ? -between(1, 40) * MIN : between(20, 3600) * MIN),
      };
      state.order.push(id);
    });
    set(`ailearn-drill:${u.id}`, state);
    decks.push(u);
  }
  return decks;
}

const tokens = (s) => String(s || '').split(/[\s·,()·—\-–/]+/).filter((w) => w.length >= 2);

function clozeCards(entry) {
  const s = entry.sentence || '';
  const blanks = (entry.blanks || []).filter((b) => b.term && s.includes(b.term));
  if (!blanks.length) return [];
  return blanks.slice(0, 2).map((b) => ({ q: s.split(b.term).join(' ____ '), a: b.term }));
}

async function seedClozeDecks(unitsBySubject) {
  const decks = [];
  for (const s of SUBJECTS) {
    if (s.id === 'math') continue;
    const units = unitsBySubject[s.id] || [];
    if (!units.length) continue;

    let pool = [];
    try {
      const r = await fetch(`/data/cards/${encodeURIComponent(s.tax_key)}.json`);
      if (r.ok) pool = (await r.json()).cards || [];
    } catch { }
    if (!pool.length) continue;

    const byChapter = new Map();
    pool.forEach((c) => {
      const key = c.chapter || (c.section_path || []).slice(-1)[0] || '기타';
      if (!byChapter.has(key)) byChapter.set(key, []);
      byChapter.get(key).push(c);
    });
    const chapters = [...byChapter.keys()];
    let rotate = 0;

    units.slice(0, between(4, 7)).forEach((u) => {
      const ut = tokens(u.title);
      let best = null; let bestScore = 0;
      chapters.forEach((ch) => {
        const n = tokens(ch).filter((w) => ut.some((x) => x.includes(w) || w.includes(x))).length;
        if (n > bestScore) { bestScore = n; best = ch; }
      });
      const chapter = best || chapters[(rotate += 1) % chapters.length];
      const cards = byChapter.get(chapter).flatMap(clozeCards).slice(0, between(8, 16));
      if (cards.length < 4) return;

      const state = { cards: {}, order: [], created: Date.now() - 14 * DAY, updated: Date.now() - between(1, 6) * DAY };
      cards.forEach((c, i) => {
        const id = 'c' + i;
        const roll = rnd();
        const box = roll < 0.3 ? between(3, 5) : roll < 0.75 ? between(1, 2) : 0;
        const seen = box === 0 ? between(0, 1) : box + between(0, 2);
        const correct = Math.max(0, seen - between(0, 2));
        state.cards[id] = {
          id, q: c.q, a: c.a, box, seen, correct,
          wrong: Math.max(0, seen - correct),
          due: Date.now() + (rnd() < 0.025 ? -between(1, 60) * MIN : between(30, 5000) * MIN),
        };
        state.order.push(id);
      });
      set(`ailearn-drill:${u.id}`, state);
      decks.push(u);
    });
  }
  return decks;
}

function seedMastery(unitsBySubject, decks) {
  const mastery = {};
  const deckIds = new Set(decks.map((d) => d.id));

  decks.forEach((u) => {
    const attempted = between(8, 34);
    const accuracy = 0.55 + rnd() * 0.42;
    const coverage = 0.35 + rnd() * 0.6;
    mastery[u.id] = {
      coverage: Math.min(1, coverage),
      accuracy,
      status: coverage >= 0.95 && accuracy >= 0.8 ? 'mastered' : 'in_progress',
      last_studied: daysAgo(between(0, 6)).toISOString(),
      next_review: new Date(Date.now() + between(1, 7) * DAY).toISOString(),
      srs_box: between(0, 3),
      attempted,
      correct: Math.round(attempted * accuracy),
    };
  });

  SUBJECTS.forEach((s) => {
    const units = (unitsBySubject[s.id] || []).filter((u) => !deckIds.has(u.id));
    const n = Math.min(units.length, s.id === 'math' ? 14 : between(3, 9));
    units.slice(0, n).forEach((u) => {
      const roll = rnd();
      const accuracy = 0.5 + rnd() * 0.45;
      const coverage = roll < 0.28 ? 0.95 + rnd() * 0.05 : 0.2 + rnd() * 0.6;
      const attempted = between(4, 22);
      mastery[u.id] = {
        coverage,
        accuracy,
        status: coverage >= 0.95 && accuracy >= 0.8 ? 'mastered' : 'in_progress',
        last_studied: daysAgo(between(1, 20)).toISOString(),
        next_review: new Date(Date.now() + between(1, 12) * DAY).toISOString(),
        srs_box: between(0, 4),
        attempted,
        correct: Math.round(attempted * accuracy),
      };
    });
  });

  set('ailearn-mastery', mastery);
  return mastery;
}

function seedAnswers(decks) {
  decks.slice(0, 5).forEach((u) => {
    const n = between(2, 4);
    const history = Array.from({ length: n }, () => ({
      ts: daysAgo(between(1, 16)).toISOString(),
      score: between(9, 24),
      max: 30,
      level: pick(['easy', 'normal', 'hard']),
      unit: u.title,
    }));
    set(`ailearn-answers:${u.id}`, history);
  });
}

function seedWrongNotes(decks) {
  const notes = decks.slice(0, 6).map((u, i) => ({
    id: `wn_demo_${i}`,
    ts: daysAgo(between(0, 11)).toISOString(),
    unitId: u.id,
    unit: u.title,
    path: [u.subject, u.area, u.title],
    text: `${u.title} — 서술형 연습에서 핵심 요소를 빠뜨렸습니다.`,
    myAnswer: '개념 설명은 했지만 지도 방안을 쓰지 못했습니다.',
    answer: '개념의 의미와 함께 구체적인 지도 순서를 함께 서술해야 합니다.',
    score: between(2, 4),
    max: 5,
  }));
  set('ailearn-wrongnote', notes);
}

function seedStreakAndTime() {
  const dates = [];
  for (let i = 0; i < 26; i += 1) {
    if (i < 12 || rnd() < 0.62) dates.push(dayKey(daysAgo(i)));
  }
  dates.sort();
  set('ailearn-streak', {
    current: 12,
    longest: 19,
    last_active: dayKey(new Date()),
    active_dates: dates.slice(-60),
  });

  const time = {};
  dates.forEach((k, idx) => {
    const heavy = idx % 5 === 0;
    const ai = between(heavy ? 1800 : 600, heavy ? 4200 : 2100);
    const quiz = between(heavy ? 1200 : 400, heavy ? 3000 : 1500);
    const slots = {};
    let left = ai + quiz;
    const startSlot = between(7 * 6, 13 * 6);
    for (let s = startSlot; s < startSlot + between(10, 30) && left > 0; s += 1) {
      const chunk = Math.min(left, between(120, 560));
      slots[s] = { ai: Math.round(chunk * 0.6), quiz: Math.round(chunk * 0.4) };
      left -= chunk;
    }
    time[k] = {
      ai, quiz, slots,
      subjects: {
        math: { secs: Math.round((ai + quiz) * 0.55), units: {} },
        korean: { secs: Math.round((ai + quiz) * 0.2), units: {} },
        general: { secs: Math.round((ai + quiz) * 0.25), units: {} },
      },
    };
  });
  const today = dayKey(new Date());
  time[today] = time[today] || { ai: 1450, quiz: 980, slots: {}, subjects: {} };
  set('quiz-studytime-v1', time);
}

function seedProfile() {
  const now = new Date();
  let year = now.getFullYear();
  if (now.getMonth() >= 10 && now.getDate() > 14) year += 1;
  const nov = new Date(year, 10, 1);
  const firstSat = new Date(year, 10, 1 + ((6 - nov.getDay() + 7) % 7));
  set('profile', {
    name: '김임용',
    persona: '초수',
    examDate: firstSat.toISOString().slice(0, 10),
    region: '서울',
    createdAt: daysAgo(26).toISOString(),
  });
  set('ailearn-prefs', { daily_cap: 500, model: 'claude-haiku-4-5-20251001' });
}

export async function seedDemo() {
  const unitsBySubject = await loadUnits();
  const mathDecks = await seedDecks(unitsBySubject.math || []);
  const clozeDecks = await seedClozeDecks(unitsBySubject);
  const decks = [...mathDecks, ...clozeDecks];
  seedProfile();
  seedMastery(unitsBySubject, decks);
  seedAnswers(mathDecks);
  seedWrongNotes(mathDecks);
  seedStreakAndTime();
  set('ailearn-unit-intro', Object.fromEntries(decks.map((u) => [u.id, pick(['lecture', 'repeat'])])));
  return { units: decks.length };
}
