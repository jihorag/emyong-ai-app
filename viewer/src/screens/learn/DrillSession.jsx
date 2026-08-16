import { useState, useEffect } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import { buildLocalCards } from '../../data/drillCards';
import {
  allCards, hasDrill, initDrill, grade as gradeCard, snapshot, MASTER_BOX,
} from '../../data/stores/drillStore';
import { markActiveToday, recordGrade, updateChapterMastery } from '../../data/stores/learningStore';
import { useStudyActivity } from '../../app/useStudyTimer';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

const BOX_MAX = 5;

const FILTERS = [
  { key: 'all',  label: '전체' },
  { key: 'weak', label: '아직 못 외운 것' },
  { key: 'done', label: '완벽' },
];

const VIEW_ICON = {
  list: 'M4 6.5h3.5v3.5H4zM4 14h3.5v3.5H4zM11 7.2h9M11 10.6h6M11 14.7h9M11 18.1h6',
  card: 'M4 6.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM3 11.2h18',
};

function Dots({ box, size = 6 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}
      aria-label={`정착도 ${box} / ${BOX_MAX}`}>
      {Array.from({ length: BOX_MAX }, (_, i) => (
        <span key={i} style={{
          width: size, height: size, borderRadius: '50%',
          background: i < box ? brand.primaryInk : line.base,
        }} />
      ))}
    </span>
  );
}

function ViewToggle({ mode, onToggle }) {
  const next = mode === 'card' ? 'list' : 'card';
  return (
    <button onClick={onToggle} style={toggleBtn}
      aria-label={next === 'list' ? '카드 목록 보기' : '한 장씩 보기'}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={brand.primary}
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={VIEW_ICON[next]} />
      </svg>
    </button>
  );
}

const byUrgency = (a, b) => (a.due - b.due) || (a.box - b.box) || (a.seen - b.seen);

function buildRound(unitId, full) {
  const t = Date.now();
  const arr = allCards(unitId);
  const pool = full ? arr : arr.filter((c) => c.box < MASTER_BOX || c.due <= t);
  return pool.sort(byUrgency).map((c) => c.id);
}

export default function DrillSession({ unit, onBack, onRecall }) {
  useStudyActivity('quiz');
  const [mode, setMode] = useState('card');
  const [filter, setFilter] = useState('all');
  const [cards, setCards] = useState([]);
  const [queue, setQueue] = useState([]);
  const [roundTotal, setRoundTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      if (!hasDrill(unit.id)) {
        const md = await loadUnitStudy(unit.subject, unit);
        if (!active) return;
        const local = buildLocalCards(md, unit);
        if (local.length) initDrill(unit.id, local.slice(0, 40));
      }
      if (!active) return;
      const round = buildRound(unit.id, false);
      setCards(allCards(unit.id));
      setQueue(round);
      setRoundTotal(round.length);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [unit]);

  const total = cards.length;
  const mastered = cards.filter((c) => c.box >= MASTER_BOX).length;
  const card = cards.find((c) => c.id === queue[0]) || null;
  const passed = roundTotal - new Set(queue).size;
  const done = !loading && !!total && !card;

  const answer = (ok) => {
    if (!card) return;
    gradeCard(unit.id, card.id, ok);
    markActiveToday();
    try {
      recordGrade(unit.id, ok);
      const s = snapshot(unit.id);
      if (s?.total) updateChapterMastery(unit.id, { coverage: s.coverage });
    } catch { }

    setCards(allCards(unit.id));
    setFlipped(false);
    setQueue((q) => (ok ? q.slice(1) : [...q.slice(1), q[0]]));
  };

  const restart = () => {
    const round = buildRound(unit.id, true);
    setFlipped(false);
    setQueue(round);
    setRoundTotal(round.length);
  };

  if (mode === 'list') {
    const list = cards.filter((c) => (
      filter === 'all' ? true : filter === 'weak' ? c.box < MASTER_BOX : c.box >= MASTER_BOX
    ));
    return (
      <div className="app-container">
        <HubHeader title={unit.title} onBack={onBack}
          action={<ViewToggle mode={mode} onToggle={() => setMode('card')} />} />
        <main className="main-content">
          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ ...chip, ...(filter === f.key ? chipOn : null) }}>{f.label}</button>
            ))}
          </div>
          {!list.length && (
            <div style={{ padding: '48px 0', textAlign: 'center', color: ink.faint, fontSize: '0.88rem' }}>
              {total ? '이 조건에 맞는 카드가 없어요' : '아직 카드가 없어요'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((c) => (
              <div key={c.id} style={listCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '0.92rem',
                    color: brand.primaryInk, lineHeight: 1.5 }}>{c.q}</span>
                  <span style={{ marginTop: 5 }}><Dots box={c.box} size={5} /></span>
                </div>
                <div style={{ fontSize: '0.86rem', color: ink.body, lineHeight: 1.6, marginTop: 9 }}>
                  {c.a}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container" style={fullHeight}>
      <HubHeader title="스제트 연습" sub={unit.title} onBack={onBack}
        action={<ViewToggle mode={mode} onToggle={() => setMode('list')} />} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 20px 0' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: ink.sub, flexShrink: 0 }}>
          {passed} / {roundTotal}
        </span>
        <div style={bar}>
          <div style={{ ...barFill, width: roundTotal ? `${(passed / roundTotal) * 100}%` : 0 }} />
        </div>
      </div>

      <div style={stage}>
        {loading && <div style={{ color: ink.faint, fontSize: '0.88rem' }}>카드를 꺼내는 중…</div>}

        {!loading && !total && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.95rem', color: ink.body, fontWeight: 700 }}>
              아직 이 단원의 카드가 없어요
            </div>
            <div style={{ fontSize: '0.84rem', color: ink.faint, marginTop: 8, lineHeight: 1.6 }}>
              기억 확인을 한 번 돌리면<br />노트에서 카드를 만들어 둘게요
            </div>
            <button onClick={onRecall} style={{ ...primaryBtn, marginTop: 20, width: 'auto', padding: '13px 22px' }}>
              기억 확인으로 가기
            </button>
          </div>
        )}

        {done && (
          <div style={{ textAlign: 'center' }}>
            <img src="/imyong.png" alt="이묭이" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: ink.strongest, marginTop: 14 }}>
              오늘 볼 카드를 다 넘겼어요
            </div>
            <div style={{ fontSize: '0.85rem', color: ink.muted, marginTop: 8 }}>
              {roundTotal}장 확인 · 완벽{' '}
              <b style={{ color: mastered ? semantic.success : ink.body }}>{mastered} / {total}</b>
            </div>
            <button onClick={restart} style={{ ...primaryBtn, marginTop: 20, width: 'auto', padding: '13px 22px' }}>
              전체 카드 다시 보기
            </button>
          </div>
        )}

        {card && (
          <button onClick={() => setFlipped((f) => !f)} style={flashCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.72rem', color: ink.faint }}>
                정착도 <Dots box={card.box} />
              </span>
              <span style={{ fontSize: '0.72rem', color: ink.faint }}>{flipped ? '뒷면' : '앞면'}</span>
            </div>

            <div style={faceBody}>
              {flipped && (
                <div style={{ fontSize: '0.8rem', color: ink.faint, lineHeight: 1.55, marginBottom: 14 }}>
                  {card.q}
                </div>
              )}
              <div style={{ fontSize: flipped ? '1.2rem' : '1.32rem', fontWeight: 800,
                color: ink.strongest, lineHeight: 1.45, wordBreak: 'keep-all' }}>
                {flipped ? card.a : card.q}
              </div>
              {!flipped && (
                <div style={{ fontSize: '0.8rem', color: ink.faint, marginTop: 16 }}>탭하면 답이 보여요</div>
              )}
            </div>
          </button>
        )}
      </div>

      <div style={{ padding: '0 20px 18px', minHeight: 62 }}>
        {card && flipped ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => answer(false)} style={{ ...judgeBtn, ...judgeAgain }}>아직이에요</button>
            <button onClick={() => answer(true)} style={{ ...judgeBtn, ...judgeGot }}>외웠어요</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: ink.faint, paddingTop: 14 }}>
            한 장씩 천천히 떠올려보세요
          </div>
        )}
      </div>
    </div>
  );
}

const fullHeight = {
  display: 'flex', flexDirection: 'column',
  minHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))',
};

const toggleBtn = {
  width: 36, height: 36, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
  border: `1px solid ${line.base}`, background: surface.card,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const bar = { flex: 1, height: 7, borderRadius: 999, background: line.soft, overflow: 'hidden' };
const barFill = { height: '100%', borderRadius: 999, background: brand.primary, transition: 'width .3s ease' };

const stage = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px 20px 12px', minHeight: 0,
};

const flashCard = {
  width: '100%', minHeight: 300, borderRadius: 20, cursor: 'pointer',
  background: surface.card, border: `1px solid ${line.base}`, boxShadow: shadow.md,
  padding: '18px 22px 26px', display: 'flex', flexDirection: 'column',
};
const faceBody = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 0',
};

const judgeBtn = {
  flex: 1, padding: '14px', borderRadius: 14, fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer',
};
const judgeAgain = { border: `1px solid ${line.base}`, background: surface.card, color: ink.muted };
const judgeGot = { border: 'none', background: brand.primary, color: ink.onBrand };

const primaryBtn = {
  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
  background: brand.primary, color: ink.onBrand, fontWeight: 800, fontSize: '0.94rem', cursor: 'pointer',
};

const chip = {
  fontSize: '0.79rem', fontWeight: 700, padding: '8px 14px', borderRadius: 999,
  border: `1px solid ${line.base}`, background: surface.card, color: ink.muted, cursor: 'pointer',
};
const chipOn = { background: brand.primary, borderColor: brand.primary, color: ink.onBrand };

const listCard = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 16,
  padding: '16px 17px', boxShadow: shadow.sm, minHeight: 104,
};
