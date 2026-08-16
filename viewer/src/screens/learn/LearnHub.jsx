import { useState, useEffect, useMemo } from 'react';
import { loadSubjectModel } from '../../data/dataModel';
import UnitPicker from '../../components/UnitPicker';
import { SUBJECTS } from '../../data/subjects';
import { snapshot } from '../../data/stores/drillStore';
import { unitIdsWithDrill } from '../../data/recommend';
import WrongNoteList from '../variant/WrongNoteList';
import { DeckList, ConceptList } from './MyLearning';
import HubHeader from '../../components/HubHeader';
import NoteView from '../review/NoteView';
import UnitPractice from '../variant/VariantPractice';
import EssayGrader from '../essay/EssayGrader';
import UnitStages from './UnitStages';
import RecallSession from './RecallSession';
import ApplySession from './ApplySession';
import { brand, ink, line, surface, shadow } from '../../styles/tokens';

export default function LearnHub({ initialUnit = null, onExitUnit, navigate, intent = null, onConsumeIntent, leavesBySubject = {} }) {
  const [subject, setSubject] = useState(initialUnit?.subject || null);
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState(initialUnit);
  const [view, setView] = useState('stages');
  const [essay, setEssay] = useState(intent === 'essay');
  const [mode, setMode] = useState('curriculum');
  const [my, setMy] = useState(null);
  const [preset, setPreset] = useState({});

  useEffect(() => {
    let active = true;
    fetch('/data/cards/variant_math.json').then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (active) setPreset(d || {}); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!subject) { setModel(null); return; }
    let active = true;
    setLoading(true);
    loadSubjectModel(subject).then((m) => { if (active) { setModel(m); setLoading(false); } });
    return () => { active = false; };
  }, [subject]);

  const subjectStats = useMemo(() => {
    const drilled = new Set(unitIdsWithDrill());
    const out = {};
    SUBJECTS.forEach((s) => {
      const units = leavesBySubject[s.id] || [];
      const hasNote = units.some((u) => u.study_file);
      let cov = 0; let n = 0;
      units.forEach((u) => {
        if (!drilled.has(u.id)) return;
        const snap = snapshot(u.id);
        if (snap) { cov += snap.coverage; n += 1; }
      });
      out[s.id] = {
        hasNote,
        empty: units.length === 0,
        pct: n ? Math.round((cov / n) * 100) : null,
      };
    });
    return out;
  }, [leavesBySubject]);

  const leaveUnit = () => { setUnit(null); onExitUnit?.(); };
  const openUnit = (u, v = 'stages') => { setView(v); setUnit(u); };

  if (essay) return <EssayGrader onBack={() => { setEssay(false); setMode('curriculum'); onConsumeIntent?.(); }} />;

  if (unit) {
    if (view === 'note') return <NoteView unit={unit} onBack={() => setView('stages')} onChat={() => setView('recall')} />;
    if (view === 'practice') return <UnitPractice unit={unit} preGen={preset[unit.id]} onBack={() => setView('stages')} />;
    if (view === 'apply') return <ApplySession unit={unit} onBack={() => setView('stages')} />;
    if (view === 'recall') return (
      <RecallSession
        unit={unit}
        onBack={() => setView('stages')}
        onSwitch={(k) => setView(k === 'apply' ? 'apply' : 'note')}
        onNote={() => setView('note')}
        onHome={() => navigate?.('home')}
      />
    );
    const WAY_VIEW = { read: 'note', quiz: 'practice', recall: 'recall', apply: 'apply', drill: 'recall' };
    return <UnitStages unit={unit} onBack={leaveUnit} onOpen={(key) => setView(WAY_VIEW[key] || 'stages')} />;
  }

  if (my === 'wrong') return <WrongNoteList onBack={() => setMy(null)} />;
  if (my === 'decks') return (
    <DeckList leavesBySubject={leavesBySubject} onBack={() => setMy(null)}
      onPickUnit={(u) => { setMy(null); openUnit(u, 'stages'); }} />
  );
  if (my === 'concepts') return <ConceptList leavesBySubject={leavesBySubject} onBack={() => setMy(null)} />;

  if (!subject) return (
    <div className="app-container">
      <HubHeader title="전체 학습" sub="과목을 고르거나, 내가 쌓아둔 걸 다시 보세요" />
      <main className="main-content">
        <section style={panel}>
          <div style={panelTitle}>학습 모드</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button onClick={() => setMode('curriculum')}
              style={{ ...modeChip, ...(mode === 'curriculum' ? modeChipOn : null) }}>교육과정</button>
            <button onClick={() => { setMode('essay'); setEssay(true); }}
              style={{ ...modeChip, ...(mode === 'essay' ? modeChipOn : null) }}>논술</button>
          </div>
          <div style={{ fontSize: '0.76rem', color: ink.muted, fontWeight: 600, marginBottom: 4 }}>과목별 학습</div>
          {SUBJECTS.map((s, i) => (
            <SubjectRow key={s.id} subject={s} stat={subjectStats[s.id]}
              first={i === 0} onClick={() => setSubject(s.id)} />
          ))}
        </section>

        <section style={panel}>
          <div style={panelTitle}>내 학습</div>
          <MyRow icon="wrong" label="오답노트" first onClick={() => setMy('wrong')} />
          <MyRow icon="decks" label="저장한 스제트" onClick={() => setMy('decks')} />
          <MyRow icon="concepts" label="내가 학습한 개념" onClick={() => setMy('concepts')} />
          <MyRow icon="qa" label="AI 질문 답변 모아보기" soon />
        </section>
      </main>
    </div>
  );

  const st = subjectStats[subject] || {};
  const subjectSub = st.pct != null ? `${st.pct}% · 정착도` : st.hasNote ? '노트 있음' : '노트 준비 중';
  return (
    <div className="app-container">
      <HubHeader title={model?.title || ''} sub={subjectSub} onBack={() => { setSubject(null); leaveUnit(); }} />
      <main className="main-content">
        {loading && <div style={{ padding: 40, textAlign: 'center', color: ink.faint }}>단원 불러오는 중…</div>}
        {!loading && model && <UnitPicker model={model} onPickUnit={(u) => openUnit(u, 'stages')} />}
      </main>
    </div>
  );
}

function SubjectRow({ subject, stat, first, onClick }) {
  const s = stat || {};
  const label = s.empty ? '준비 중' : s.pct != null ? `${s.pct}%` : s.hasNote ? '노트 있음' : '노트 준비 중';
  const strong = s.pct != null;
  return (
    <button onClick={s.empty ? undefined : onClick} disabled={s.empty}
      style={{ ...listRow, borderTop: first ? 'none' : `1px solid ${line.soft}`, cursor: s.empty ? 'default' : 'pointer' }}>
      <span style={{ ...rowIcon, ...(s.empty ? monoOff : null) }}>{subject.short.slice(0, 1)}</span>
      <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: '0.92rem',
        color: s.empty ? ink.faint : ink.strongest }}>{subject.title}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: strong ? 800 : 600,
        color: strong ? brand.primaryInk : ink.faint, flexShrink: 0 }}>{label}</span>
      <span style={{ color: ink.faint, fontSize: '1.05rem', flexShrink: 0 }}>›</span>
    </button>
  );
}

const MY_ICON = {
  wrong:    'M6.5 3.5h10A1.5 1.5 0 0 1 18 5v15l-5.5-3-5.5 3V5a1.5 1.5 0 0 1 1.5-1.5zM12 7.5v5M12 15v.01',
  decks:    'M4.5 7.5h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5zM7.5 4.5h9A1.5 1.5 0 0 1 18 6v9',
  concepts: 'M12 6.4a3 3 0 0 0-5.4 1.4 2.5 2.5 0 0 0-.5 4.4 2.8 2.8 0 0 0 2.1 4.2A2.6 2.6 0 0 0 12 18.1zM12 6.4a3 3 0 0 1 5.4 1.4 2.5 2.5 0 0 1 .5 4.4 2.8 2.8 0 0 1-2.1 4.2A2.6 2.6 0 0 1 12 18.1z',
  qa:       'M4.5 5.5h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10l-4.5 3.5V15.5h-1a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
};

function MyRow({ icon, label, first, soon, onClick }) {
  return (
    <button onClick={soon ? undefined : onClick} disabled={soon}
      style={{ ...listRow, borderTop: first ? 'none' : `1px solid ${line.soft}`, cursor: soon ? 'default' : 'pointer' }}>
      <span style={{ ...rowIcon, ...(soon ? monoOff : null) }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke={soon ? ink.faint : brand.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={MY_ICON[icon]} />
        </svg>
      </span>
      <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: '0.92rem',
        color: soon ? ink.faint : ink.strongest }}>{label}</span>
      {soon && <span style={{ fontSize: '0.74rem', color: ink.faint, flexShrink: 0 }}>준비 중</span>}
      <span style={{ color: ink.faint, fontSize: '1.05rem', flexShrink: 0 }}>›</span>
    </button>
  );
}

const panel = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 18,
  padding: '18px 18px 8px', marginBottom: 14, boxShadow: shadow.sm,
};
const panelTitle = { fontWeight: 800, fontSize: '1.02rem', color: ink.strongest, marginBottom: 12 };
const modeChip = {
  padding: '8px 16px', borderRadius: 999, fontSize: '0.84rem', fontWeight: 700,
  border: `1px solid ${line.base}`, background: surface.card, color: ink.muted, cursor: 'pointer',
};
const modeChipOn = { background: brand.primary, borderColor: brand.primary, color: surface.white };
const listRow = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
  padding: '13px 2px', background: 'none', border: 'none',
};
const rowIcon = {
  width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: brand.tint,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '0.92rem', fontWeight: 800, color: brand.primary,
};
const monoOff = { background: surface.sunken, color: ink.faint };
