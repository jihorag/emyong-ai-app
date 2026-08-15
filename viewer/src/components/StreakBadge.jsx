
import { useMemo, useState } from 'react';
import { getStreak } from '../data/stores/learningStore';
import { brand, ink, line, surface, semantic } from '../styles/tokens';

function buildCalendar(activeDates, days = 56) {
  const set = new Set(activeDates || []);
  const cells = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    cells.push({ date: key, dayOfWeek: d.getDay(), active: set.has(key) });
  }
  return cells;
}

export default function StreakBadge({ compact = false }) {
  const [streak] = useState(() => getStreak());
  const cells = useMemo(() => buildCalendar(streak.active_dates || []), [streak]);

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: streak.current > 0 ? semantic.warnTint : surface.sunken,
        color: streak.current > 0 ? semantic.warn : ink.muted,
        fontSize: '0.8rem', fontWeight: 700,
      }}>
        🔥 {streak.current}일 연속
      </div>
    );
  }

  return (
    <div style={{ padding: 14, background: surface.white, borderRadius: 10, border: `1px solid ${line.base}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: ink.strongest }}>
          🔥 학습 streak
        </h3>
        <span style={{ fontSize: '0.72rem', color: ink.faint }}>최근 8주</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={{ padding: 10, background: semantic.warnTint, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: semantic.warn, fontWeight: 700 }}>현재 연속</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: semantic.warn }}>{streak.current}일</div>
        </div>
        <div style={{ padding: 10, background: surface.accent, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: brand.primaryDeep, fontWeight: 700 }}>최장 streak</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: ink.sub }}>{streak.longest}일</div>
        </div>
        <div style={{ padding: 10, background: semantic.successTint, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: semantic.success, fontWeight: 700 }}>활동 일수</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: semantic.success }}>{(streak.active_dates || []).length}일</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
        {cells.map((c, i) => (
          <div key={i}
            title={`${c.date}${c.active ? ' · 학습' : ''}`}
            style={{
              aspectRatio: '1',
              borderRadius: 3,
              background: c.active ? semantic.success : surface.sunken,
              border: c.active ? `1px solid ${semantic.success}` : `1px solid ${line.base}`,
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: '0.7rem', color: ink.faint, textAlign: 'right' }}>
        ▢ 학습 없는 날 · <span style={{ color: semantic.success }}>■</span> 학습한 날
      </div>
    </div>
  );
}
