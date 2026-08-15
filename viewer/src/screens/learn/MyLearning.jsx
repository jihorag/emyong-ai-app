import { useMemo } from 'react';
import { snapshot } from '../../data/stores/drillStore';
import { unitIdsWithDrill } from '../../data/recommend';
import HubHeader from '../../components/HubHeader';
import { brand, ink, line, surface, shadow } from '../../styles/tokens';

const MASTER_BOX = 3;

function indexUnits(leavesBySubject) {
  const m = new Map();
  Object.values(leavesBySubject || {}).forEach((l) => (l || []).forEach((u) => m.set(u.id, u)));
  return m;
}

export function DeckList({ leavesBySubject, onBack, onPickUnit }) {
  const rows = useMemo(() => {
    const units = indexUnits(leavesBySubject);
    return unitIdsWithDrill()
      .map((id) => ({ unit: units.get(id), snap: snapshot(id) }))
      .filter((x) => x.unit && x.snap)
      .sort((a, b) => (b.snap.updated || 0) - (a.snap.updated || 0));
  }, [leavesBySubject]);

  return (
    <Shell title="저장한 스제트" sub="카드를 만들어 둔 단원이에요" onBack={onBack} empty={!rows.length}
      emptyText={<>아직 만든 스제트가 없어요.<br />단원에서 <b>스제트 연습</b>을 한 번 시작하면 여기 쌓여요.</>}>
      {rows.map(({ unit, snap }) => (
        <button key={unit.id} onClick={() => onPickUnit?.(unit)} style={row}>
          <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <span style={rowTitle}>{unit.title}</span>
            <span style={rowSub}>{unit.path.slice(0, 2).join(' · ')}</span>
          </span>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: brand.primaryDeep, flexShrink: 0 }}>
            {snap.mastered}/{snap.total}장
          </span>
          <span style={chev}>›</span>
        </button>
      ))}
    </Shell>
  );
}

export function ConceptList({ leavesBySubject, onBack }) {
  const rows = useMemo(() => {
    const units = indexUnits(leavesBySubject);
    const out = [];
    unitIdsWithDrill().forEach((id) => {
      const unit = units.get(id);
      if (!unit) return;
      let raw;
      try { raw = JSON.parse(localStorage.getItem('ailearn-drill:' + id) || 'null'); } catch { raw = null; }
      if (!raw?.order) return;
      raw.order.forEach((cid) => {
        const c = raw.cards?.[cid];
        if (c && c.box >= MASTER_BOX) out.push({ unit, q: c.q, a: c.a, box: c.box });
      });
    });
    return out.sort((a, b) => b.box - a.box);
  }, [leavesBySubject]);

  return (
    <Shell title="내가 학습한 개념" sub={`정착시킨 카드 ${rows.length}장`} onBack={onBack} empty={!rows.length}
      emptyText={<>아직 정착시킨 카드가 없어요.<br />같은 카드를 여러 번 맞히면 여기로 올라와요.</>}>
      {rows.map((r, i) => (
        <div key={i} style={{ ...row, cursor: 'default' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={rowTitle}>{r.q}</span>
            <span style={{ ...rowSub, color: brand.primaryInk, fontWeight: 700 }}>{r.a}</span>
            <span style={{ ...rowSub, marginTop: 4 }}>{r.unit.title}</span>
          </span>
        </div>
      ))}
    </Shell>
  );
}

function Shell({ title, sub, onBack, empty, emptyText, children }) {
  return (
    <div className="app-container">
      <HubHeader title={title} sub={sub} onBack={onBack} />
      <main className="main-content">
        {empty ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: ink.faint, fontSize: '0.86rem', lineHeight: 1.8 }}>
            {emptyText}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
        )}
      </main>
    </div>
  );
}

const row = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 14,
  padding: '13px 16px', boxShadow: shadow.sm, cursor: 'pointer', textAlign: 'left',
};
const rowTitle = { display: 'block', fontWeight: 700, fontSize: '0.9rem', color: ink.strongest, lineHeight: 1.5 };
const rowSub = { display: 'block', fontSize: '0.74rem', color: ink.faint, marginTop: 3 };
const chev = { color: ink.faint, fontSize: '1.1rem', flexShrink: 0 };
