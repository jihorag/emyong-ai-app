import { useState, useEffect } from 'react';
import { loadUnitStudy } from '../../data/dataModel';
import { snapshot } from '../../data/stores/drillStore';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

const WAYS = [
  { key: 'read',    label: '개념 읽기',     desc: '정리 노트로 기준 지식 확인', icon: 'book',  needsNote: true },
  { key: 'recall',  label: '기억 확인',     desc: '외운 걸 말로 꺼내보기',      icon: 'brain' },
  { key: 'apply',   label: '개념 활용',     desc: '배운 개념을 새 상황에 적용', icon: 'bulb' },
  { key: 'drill',   label: '스제트 연습',   desc: '한 줄 카드로 간격 반복 암기', icon: 'cards' },
  { key: 'quiz',    label: '문제 풀기',     desc: '오늘 개념으로 문제',         icon: 'pen' },
];

const ICON = {
  book: 'M4 4.5h6a2.5 2.5 0 0 1 2 2.5 2.5 2.5 0 0 1 2-2.5h6v13h-6a2.5 2.5 0 0 0-2 2 2.5 2.5 0 0 0-2-2H4zM12 7v12',
  brain: 'M12 6.4a3 3 0 0 0-5.4 1.4 2.5 2.5 0 0 0-.5 4.4 2.8 2.8 0 0 0 2.1 4.2A2.6 2.6 0 0 0 12 18.1zM12 6.4a3 3 0 0 1 5.4 1.4 2.5 2.5 0 0 1 .5 4.4 2.8 2.8 0 0 1-2.1 4.2A2.6 2.6 0 0 1 12 18.1z',
  bulb: 'M9.5 18.5h5M10.5 21h3M12 3a6 6 0 0 0-3.4 10.9c.3.2.4.6.4 1v.6h6v-.6c0-.4.1-.8.4-1A6 6 0 0 0 12 3z',
  cards: 'M6.5 3.5h8L18.5 7v12a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM14.5 3.5V7h4M8.5 12h7M8.5 16h4.5',
  pen: 'M4 20l4.6-1.1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10zM14.5 6.9l3.1 3.1',
};

function WayIcon({ name, filled }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
      stroke={filled ? ink.onBrand : brand.primary} strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

export default function UnitStages({ unit, onBack, onOpen }) {
  const [hasNote, setHasNote] = useState(false);
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSnap(snapshot(unit.id));
    loadUnitStudy(unit.subject, unit).then((md) => {
      if (!active) return;
      setHasNote(!!(md || '').trim());
      setLoading(false);
    });
    return () => { active = false; };
  }, [unit]);

  const suggested = !snap ? 'read' : (snap.dueNow > 0 ? 'drill' : 'recall');

  return (
    <div className="app-container">
      <HubHeader title={unit.title} sub={unit.path.slice(0, 2).join(' · ')} onBack={onBack} />
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <img src="/imyong.png" alt="이묭이"
            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: ink.body }}>
            {unit.title}, 어떻게 학습할까요?
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {WAYS.map((w) => {
            const locked = w.needsNote && !loading && !hasNote;
            const on = w.key === suggested && !locked;
            return (
              <button key={w.key} disabled={locked}
                onClick={locked ? undefined : () => onOpen?.(w.key)}
                style={{ ...wayCard, ...(on ? wayCardOn : null), ...(locked ? wayCardOff : null) }}>
                <span style={{ ...iconBox, ...(on ? iconBoxOn : null) }}>
                  <WayIcon name={w.icon} filled={on} />
                </span>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem', color: locked ? ink.faint : ink.strongest, marginTop: 10 }}>
                  {w.label}
                </span>
                <span style={{ display: 'block', fontSize: '0.73rem', color: ink.faint, marginTop: 3, lineHeight: 1.45 }}>
                  {locked ? '노트 준비 중' : w.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 800, fontSize: '1rem', color: ink.strongest, margin: '24px 2px 10px' }}>
          나의 학습 상황
        </div>
        <StatusCard snap={snap} />
      </main>
    </div>
  );
}

function StatusCard({ snap }) {
  const s = snap || { coverage: 0, accuracy: 0, attempts: 0, weak: [], updated: 0 };
  const pct = Math.round(s.coverage * 100);
  const acc = Math.round(s.accuracy * 100);
  const weak = s.weak?.[0]?.q || '';
  return (
    <div style={statusBox}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: ink.sub }}>정착도</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: brand.primaryInk }}>{pct}%</span>
      </div>
      <div style={bar}>
        <div style={{ ...barFill, width: `${pct}%` }} />
      </div>
      {weak && (
        <div style={{ fontSize: '0.78rem', color: ink.muted, marginTop: 12 }}>
          약한 개념: <b style={{ color: ink.body }}>{weak.length > 26 ? `${weak.slice(0, 26)}…` : weak}</b>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.78rem', color: brand.primaryInk, fontWeight: 600 }}>
        <span>{s.attempts}회 복습</span>
        <span>{acc}% 정답률</span>
        <span style={{ color: ink.faint }}>{lastSeen(s.updated)}</span>
      </div>
    </div>
  );
}

function lastSeen(ts) {
  if (!ts) return '아직 학습 전';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return '오늘 학습';
  if (days === 1) return '어제 마지막';
  return `${days}일 전 마지막`;
}

const wayCard = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 16,
  padding: '15px 15px 17px', textAlign: 'left', cursor: 'pointer',
  boxShadow: shadow.sm, minHeight: 118,
};
const wayCardOn = { border: `1.5px solid ${brand.primary}`, background: brand.tintSoft };
const wayCardOff = { background: surface.sunken, border: `1px solid ${line.neutral}`, boxShadow: 'none', cursor: 'default' };

const iconBox = {
  width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: brand.tint,
};
const iconBoxOn = { background: brand.primary };

const statusBox = {
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 16,
  padding: '16px 18px', boxShadow: shadow.sm,
};
const bar = { height: 8, borderRadius: 999, background: surface.sunken, marginTop: 10, overflow: 'hidden' };
const barFill = { height: '100%', borderRadius: 999, background: semantic.success };
