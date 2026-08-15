// ⚠ group 이 붙은 영역(각론)은 하나로 묶어야 한다 —
import { useState } from 'react';
import { snapshot } from '../data/stores/drillStore';
import { brand, ink, line, surface, shadow } from '../styles/tokens';

function Dots({ unitId }) {
  const s = snapshot(unitId);
  const filled = s ? Math.min(5, Math.round(s.coverage * 5)) : 0;
  return (
    <span style={{ display: 'flex', gap: 3, flexShrink: 0 }} aria-label={`정착도 ${filled}/5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i < filled ? brand.primary : line.base,
        }} />
      ))}
    </span>
  );
}

export default function UnitPicker({ model, onPickUnit }) {
  const blocks = [];
  const byGroup = new Map();
  model.areas.forEach((a) => {
    if (!a.group) { blocks.push({ key: a.name, label: a.no ? `${a.no}. ${a.name}` : a.name, areas: [a] }); return; }
    if (!byGroup.has(a.group)) {
      const b = { key: `g:${a.group}`, label: `IV. ${a.group}`, areas: [] };
      byGroup.set(a.group, b); blocks.push(b);
    }
    byGroup.get(a.group).areas.push(a);
  });
  const countOf = (b) => b.areas.reduce((n, a) => n + a.units.length, 0);

  const [open, setOpen] = useState(() => (blocks.length ? { [blocks[0].key]: true } : {}));
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((b) => {
        const isOpen = !!open[b.key];
        const grouped = b.areas.length > 1;
        return (
          <div key={b.key} style={{ borderRadius: 14, overflow: 'hidden', boxShadow: shadow.sm }}>
            <button onClick={() => toggle(b.key)} style={{ ...blockHead, ...(isOpen ? blockHeadOpen : null) }}>
              <span style={{ ...ellipsis, flex: 1, textAlign: 'left' }}>{b.label}</span>
              {!isOpen && <span style={{ fontSize: '0.82rem', opacity: 0.85, flexShrink: 0 }}>{countOf(b)}</span>}
              <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{isOpen ? '⌄' : '›'}</span>
            </button>

            {isOpen && (
              <div style={{ background: surface.card }}>
                {b.areas.map((a) => (
                  <div key={a.name}>
                    {grouped && (
                      <div style={subHead}>
                        <span style={ellipsis}>{a.no ? `${a.no}. ${a.name}` : a.name}</span>
                        <span style={{ color: ink.faint, fontWeight: 700 }}>{a.units.length}</span>
                      </div>
                    )}
                    {a.units.map((u) => (
                      <button key={u.id} onClick={() => onPickUnit?.(u)} style={unitRow}>
                        <span style={{ ...ellipsis, flex: 1, textAlign: 'left' }}>{u.title}</span>
                        <Dots unitId={u.id} />
                        <span style={{ color: ink.faint, fontSize: '1rem', flexShrink: 0 }}>›</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ellipsis = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

const blockHead = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '15px 16px', border: 'none', cursor: 'pointer',
  background: brand.primary, color: surface.white, fontWeight: 800, fontSize: '0.96rem',
};
const blockHeadOpen = { background: brand.primary };

const subHead = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  padding: '10px 16px', background: surface.sunken,
  fontSize: '0.82rem', fontWeight: 800, color: ink.body,
};

const unitRow = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '14px 16px', background: surface.card, border: 'none',
  borderTop: `1px solid ${line.soft}`, cursor: 'pointer',
  fontSize: '0.92rem', fontWeight: 700, color: ink.strongest,
};
