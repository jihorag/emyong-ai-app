import { ink, line, surface } from '../styles/tokens';

const SERIF = '"AppleMyungjo","Nanum Myeongjo","Batang",serif';

function renderInline(text, kp) {
  if (text == null) return null;
  const parts = String(text).split(/(__[^_]+__|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('__') && p.endsWith('__') && p.length > 4) {
      return <u key={`${kp}-u${i}`} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{p.slice(2, -2)}</u>;
    }
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return <strong key={`${kp}-b${i}`}>{p.slice(2, -2)}</strong>;
    }
    return p ? <span key={`${kp}-t${i}`}>{p}</span> : null;
  });
}

function renderBoxLine(line, kp) {
  const m = line.match(/^\s*([^:："'\d][^:：]{0,14}?)\s*[:：]\s*(.+)$/);
  if (m) {
    return (
      <div style={{ margin: '5px 0', lineHeight: 1.75 }}>
        <strong style={{ color: ink.strongest }}>{m[1]}</strong>
        <span>&nbsp;&nbsp;{renderInline(m[2], kp)}</span>
      </div>
    );
  }
  return <div style={{ margin: '5px 0', lineHeight: 1.75 }}>{renderInline(line, kp)}</div>;
}

const BOX_HEAD = /^\s*[〈<【[]\s*(.+?)\s*[〉>】\]]\s*$/;
const isJeom = (l) => /^\s*[[(（]?\s*(배점\s*)?\d+\s*점\s*[\])）]?\s*$/.test(l);
const jeomNum = (l) => (l.match(/(\d+)\s*점/) || [])[1];

export default function ExamCard({ raw }) {
  const lines = String(raw || '').split('\n');
  let jeom = null;
  const stem = [];
  const boxes = [];
  let cur = null;
  let seenBox = false;

  lines.forEach((ln) => {
    const t = ln.trim();
    if (!seenBox && !cur && jeom == null && isJeom(t)) { jeom = jeomNum(t); return; }
    const bh = t.match(BOX_HEAD);
    if (bh && !isJeom(t) && (/[〈<【]/.test(t) || /^(자료|보기|대화|수업|조건|상황)/.test(bh[1]))) {
      cur = { label: bh[1], lines: [] };
      boxes.push(cur);
      seenBox = true;
      return;
    }
    if (cur) { if (t !== '') cur.lines.push(ln); return; }
    if (t !== '') stem.push(ln);
  });

  return (
    <div style={card}>
      <div style={topBar}>
        <span style={tag}>서답형</span>
        <span style={jeomBox}>{jeom ? `[${jeom}점]` : ''}</span>
      </div>
      {stem.length > 0 && (
        <div style={stemStyle}>
          {stem.map((l, i) => <div key={i} style={{ margin: '2px 0' }}>{renderInline(l, `s${i}`)}</div>)}
        </div>
      )}
      {boxes.map((b, bi) => (
        <div key={bi} style={boxStyle}>
          {b.label && <div style={boxLabel}>〈 {b.label} 〉</div>}
          {b.lines.map((l, li) => <div key={li}>{renderBoxLine(l, `b${bi}-${li}`)}</div>)}
        </div>
      ))}
    </div>
  );
}

const card = {
  fontFamily: SERIF, background: surface.white, color: ink.strongest,
  border: `1px solid ${line.strong}`, borderRadius: 6, padding: '18px 20px 20px',
  margin: '6px 0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${ink.body}`, paddingBottom: 8, marginBottom: 12 };
const tag = { fontFamily: 'system-ui, sans-serif', fontSize: '0.7rem', fontWeight: 800, color: surface.white, background: ink.body, borderRadius: 4, padding: '3px 9px', letterSpacing: 1 };
const jeomBox = { fontSize: '0.92rem', fontWeight: 800, color: ink.body };
const stemStyle = { fontSize: '1rem', lineHeight: 1.85, color: ink.strongest, letterSpacing: '-0.1px', marginBottom: 14 };
const boxStyle = { border: `1px solid ${ink.strongest}`, borderRadius: 3, padding: '12px 16px 14px', margin: '10px 0', background: surface.page };
const boxLabel = { textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: ink.body, marginBottom: 8, letterSpacing: 2 };
