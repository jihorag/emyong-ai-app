
import { getSubjectMeta } from './subjects';

const _cache = new Map();
let _practiceAll = null;

async function fetchJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function loadAllPractice() {
  if (_practiceAll) return _practiceAll;
  const d = await fetchJson('/data/cards/all_practice.json');
  _practiceAll = (d && d.cards) || [];
  return _practiceAll;
}

function clozeUnitKey(subjectId, card) {
  const chapter = card.chapter || '기타';
  const sub = Array.isArray(card.section_path) ? card.section_path : [];
  return { key: `${subjectId}__${chapter}__${sub.join('__')}`, chapter, sub };
}

export function loadSubjectModel(subjectId) {
  if (_cache.has(subjectId)) return _cache.get(subjectId);
  const p = _build(subjectId);
  _cache.set(subjectId, p);
  return p;
}

async function _build(subjectId) {
  const s = getSubjectMeta(subjectId);
  const subjectTitle = s.title;
  const taxKey = s.tax_key || s.title;

  const units = new Map();
  const areaOrder = [];
  const areaMeta = {};
  const seenArea = (name) => { if (!areaOrder.includes(name)) areaOrder.push(name); };
  const ensureUnit = ({ id, area, title, path, study_file }) => {
    if (!units.has(id)) {
      units.set(id, {
        id, subject: subjectId, area, title, path,
        study_file: study_file || null,
        cloze: [], practice: [],
      });
    }
    return units.get(id);
  };

  const tax = await fetchJson(`/data/taxonomy/${encodeURIComponent(subjectId)}.json`);
  const hasTaxonomy = !!(tax && Array.isArray(tax.areas) && tax.areas.length);
  if (tax && Array.isArray(tax.areas)) {
    tax.areas.forEach((area) => {
      seenArea(area.name);
      areaMeta[area.name] = { group: area.group || null, no: area.no || null };
      (area.units || []).forEach((u) => {
        ensureUnit({
          id: u.id,
          area: area.name,
          title: u.title,
          path: [tax.subject || subjectTitle, area.name, u.title],
          study_file: u.study_file || null,
        });
      });
    });
  }

  const clozeData = await fetchJson(`/data/cards/${encodeURIComponent(taxKey)}.json`);
  const clozeCards = (clozeData && clozeData.cards) || [];
  clozeCards.forEach((card) => {
    const { key, chapter, sub } = clozeUnitKey(subjectId, card);
    let unit = units.get(key);
    if (!unit) {
      if (hasTaxonomy) return;
      seenArea(chapter);
      const title = sub.length ? sub[sub.length - 1] : chapter;
      const path = sub.length ? [subjectTitle, chapter, ...sub] : [subjectTitle, chapter];
      unit = ensureUnit({ id: key, area: chapter, title, path });
    }
    unit.cloze.push(card);
  });

  const allPractice = await loadAllPractice();
  const unitList = [...units.values()];
  allPractice.filter((p) => p.subject === subjectTitle).forEach((p) => {
    const unitTitle = p._unit || p.chapter || '';
    if (!unitTitle) return;
    const unit = unitList.find((u) =>
      u.title === unitTitle || u.title.includes(unitTitle) || u.path.some((seg) => seg.includes(unitTitle)),
    );
    if (unit) unit.practice.push(p);
  });

  const areas = areaOrder
    .map((name) => ({ name, group: areaMeta[name]?.group || null, no: areaMeta[name]?.no || null, units: [...units.values()].filter((u) => u.area === name) }))
    .filter((a) => a.units.length);

  const allUnits = [...units.values()];
  return {
    subjectId,
    title: subjectTitle,
    areas,
    stats: {
      units: allUnits.length,
      cloze: clozeCards.length,
      practice: allUnits.reduce((n, u) => n + u.practice.length, 0),
      withStudy: allUnits.filter((u) => u.study_file).length,
    },
  };
}

export async function loadUnitStudy(subjectId, unit) {
  if (!unit?.study_file) return '';
  try {
    const r = await fetch(`/data/study/${encodeURIComponent(subjectId)}/${encodeURIComponent(unit.study_file)}`);
    return r.ok ? await r.text() : '';
  } catch {
    return '';
  }
}

