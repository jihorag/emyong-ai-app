import { useState, useEffect, useMemo } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import ParsedText from '../../components/ParsedText';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface } from '../../styles/tokens';

function parseNote(md) {
  const lines = String(md || '').split('\n');
  let source = '', docTitle = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (t.startsWith('# ')) { docTitle = t.slice(2).trim(); continue; }
    if (t.startsWith('> ')) { source = t.replace(/^>\s*/, ''); continue; }
    break;
  }
  const rest = lines.slice(i);
  while (rest.length && rest[0].trim() === '') rest.shift();
  if (rest.length && docTitle && rest[0].trim() === docTitle) rest.shift();
  return { source, body: rest.join('\n').trim() };
}

export default function NoteView({ unit, onBack, onChat }) {
  const [md, setMd] = useState(null);
  useEffect(() => {
    let a = true;
    loadUnitStudy(unit.subject, unit).then((t) => { if (a) setMd(t || ''); });
    return () => { a = false; };
  }, [unit]);
  const { source, body } = useMemo(() => parseNote(md || ''), [md]);
  const hasNote = body && body.trim().length > 0;
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px)' }}>
      <HubHeader title={unit.title} sub={unit.path.slice(1, -1).join(' › ')} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', background: surface.page, padding: '14px 14px 20px' }}>
        {md === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: ink.faint }}>노트 불러오는 중…</div>
        ) : (
          <div style={noteCard}>
            <div style={noteTag}>📘 단권화 노트</div>
            <div style={noteTitle}>{unit.title}</div>
            <div style={notePath}>{unit.path.slice(1).join(' › ')}</div>
            {source && <div style={noteSource}>📖 {source}</div>}
            <div style={noteDivider} />
            {hasNote ? (
              <div className="parsed-text" style={{ fontSize: '0.92rem', lineHeight: 1.8, color: ink.body }}>
                <ParsedText text={body} />
              </div>
            ) : (
              <div style={{ color: ink.muted, fontSize: '0.9rem', lineHeight: 1.8 }}>
                이 단원 노트는 <b>준비 중</b>이에요. 곧 채워집니다.<br />
                지금은 아래 <b>이묭이와 복습</b>으로 진행할 수 있어요.
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 14px 16px', borderTop: `1px solid ${line.base}`, background: surface.white }}>
        <button onClick={onChat} style={notePrimary}>💬 이묭이랑 이 단원 복습하기</button>
      </div>
    </div>
  );
}

const noteCard = { background: surface.white, border: `1px solid ${line.base}`, borderRadius: 16, padding: '18px 20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: `4px solid ${brand.primary}` };
const noteTag = { display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, color: brand.primary, background: surface.accent, borderRadius: 999, padding: '3px 10px', marginBottom: 8 };
const noteTitle = { fontSize: '1.22rem', fontWeight: 800, color: ink.strongest };
const notePath = { fontSize: '0.76rem', color: ink.faint, marginTop: 3 };
const noteSource = { fontSize: '0.74rem', color: ink.faint, marginTop: 8, background: surface.sunken, border: `1px solid ${line.neutral}`, borderRadius: 8, padding: '6px 10px' };
const noteDivider = { height: 1, background: line.soft, margin: '12px 0 14px' };
const notePrimary = { width: '100%', padding: 13, borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${brand.primary},${brand.primaryDeep})`, color: surface.white, fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer' };
