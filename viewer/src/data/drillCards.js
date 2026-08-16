const clean = (s) => String(s || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1').replace(/[`*_]/g, '').trim();

export function clozeToCards(unit) {
  const out = [];
  (unit.cloze || []).forEach((c) => {
    const s = c.sentence || '';
    const blanks = (c.blanks || []).filter((b) => b.term && s.includes(b.term));
    if (blanks.length) blanks.forEach((b) => out.push({ q: s.split(b.term).join(' ____ '), a: b.term }));
    else if (s.length > 6) out.push({ q: `다음을 완성하세요: “${s.slice(0, 12)}…”`, a: s });
  });
  return out;
}

export function noteToCards(md, unitTitle) {
  const lines = String(md || '').split('\n');
  const s = lines.findIndex((l) => /^##\s/.test(l) && l.includes(unitTitle));
  if (s < 0) return [];
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i += 1) if (/^##\s/.test(lines[i])) { e = i; break; }

  const out = [];
  lines.slice(s + 1, e).forEach((raw) => {
    const l = raw.trim();
    const m = l.match(/^[-*]\s*\*\*(.+?)\*\*\s*[—\-:：]\s*(.+)$/)
           || l.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
    if (!m) return;
    const term = clean(m[1]).replace(/\s*\([^)]*\)\s*/g, '').trim();
    const desc = clean(m[2]).split(/(?<=[.。])\s/)[0].slice(0, 90).trim();
    if (term.length >= 2 && term.length <= 20 && desc.length >= 10) {
      out.push({ q: `${desc} — 이것은?`, a: term });
    }
  });
  return out;
}

export const buildLocalCards = (md, unit) => [...noteToCards(md, unit.title), ...clozeToCards(unit)];
