import { useState } from 'react';
import { getWrongNotes, removeWrongNote } from '../../data/stores/learningStore';
import ParsedText from '../../components/ParsedText';
import HubHeader from '../../components/HubHeader';
import { LEVELS, levelTag, rubricBox } from './levels';
import { brand, ink, surface, semantic } from '../../styles/tokens';

export default function WrongNoteList({ onBack }) {
  const [items, setItems] = useState(() => getWrongNotes());
  const del = (id) => setItems(removeWrongNote(id));
  const splitOne = (t) => {
    const m = String(t || '').split(/---\s*(?:루브릭|정답)\s*---/);
    return { q: (m[0] || '').replace(/^문제:\s*/, '').trim(), a: (m[1] || '').trim() };
  };
  return (
    <div className="app-container">
      <HubHeader title="📕 오답노트" sub={`틀리거나 어려웠던 문제 ${items.length}개`} onBack={onBack} />
      <main className="main-content">
        {items.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: ink.faint, lineHeight: 1.7 }}>
            아직 저장된 오답이 없어요.<br />변형문제를 풀고 <b>📕 오답노트 저장</b>을 누르면 여기에 모여요.
          </div>
        ) : items.map((w) => {
          const { q, a } = splitOne(w.text);
          return (
            <div key={w.id} style={wnCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={levelTag}>{LEVELS.find((l) => l.key === w.level)?.label || '변형'}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: ink.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.unitTitle}</span>
                <button onClick={() => del(w.id)} style={wnDel}>삭제</button>
              </div>
              <ParsedText text={q} />
              <details style={{ marginTop: 10 }}>
                <summary style={wnSummary}>📊 채점 루브릭·모범답안 보기</summary>
                <div style={{ ...rubricBox, marginTop: 10 }}><ParsedText text={a || '(루브릭 없음)'} /></div>
              </details>
            </div>
          );
        })}
      </main>
    </div>
  );
}

const wnCard = { background: surface.white, border: `1px solid ${surface.page}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const wnDel = { marginLeft: 'auto', flexShrink: 0, padding: '4px 10px', borderRadius: 999, border: `1px solid ${semantic.dangerLine}`, background: surface.white, color: semantic.danger, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' };
const wnSummary = { cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: brand.primaryDeep, listStyle: 'none' };
