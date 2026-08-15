import { brand, ink, line, surface, semantic } from '../styles/tokens';

export default function DrillDashboard({ snapshot: s, title }) {
  if (!s) return <div style={{ color: ink.faint, fontSize: '0.86rem' }}>아직 스제트 기록이 없어요. 🧠 스제트를 먼저 시작해 주세요.</div>;
  const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
  const accPct = Math.round((s.accuracy || 0) * 100);
  const R = 34, C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div style={wrap}>
      <div style={head}>
        <span style={{ fontSize: '1.05rem' }}>📊</span>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: ink.strongest }}>암기 대시보드</span>
        {title && <span style={{ fontSize: '0.74rem', color: ink.faint, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="86" height="86" viewBox="0 0 86 86" style={{ flexShrink: 0 }}>
          <circle cx="43" cy="43" r={R} fill="none" stroke={surface.page} strokeWidth="9" />
          <circle cx="43" cy="43" r={R} fill="none" stroke="url(#dg)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`} transform="rotate(-90 43 43)" />
          <defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={brand.primary} /><stop offset="1" stopColor={brand.primaryDeep} />
          </linearGradient></defs>
          <text x="43" y="40" textAnchor="middle" fontSize="17" fontWeight="800" fill={ink.strongest}>{pct}%</text>
          <text x="43" y="55" textAnchor="middle" fontSize="9" fill={ink.faint}>암기완료</text>
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Row c={semantic.success} label="✅ 암기 완료" v={`${s.mastered} / ${s.total}`} />
          <Row c={semantic.warn} label="📖 학습 중" v={`${s.learning}`} />
          <Row c={ink.faint} label="⬜ 아직" v={`${s.fresh}`} />
          <Row c={brand.primary} label="🎯 정답률" v={`${accPct}% (${s.correct}/${s.attempts})`} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: '0.72rem', color: ink.faint, marginBottom: 5, fontWeight: 700 }}>단계별 카드 (0=암기 전 · 5=정착)</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {s.boxes.map((n, i) => {
            const max = Math.max(1, ...s.boxes);
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 40, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${Math.max(6, (n / max) * 40)}px`, background: BOX_C[i], borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
                </div>
                <div style={{ fontSize: '0.66rem', color: ink.muted, fontWeight: 700, marginTop: 2 }}>{n}</div>
                <div style={{ fontSize: '0.6rem', color: ink.faint }}>{i}</div>
              </div>
            );
          })}
        </div>
      </div>

      {s.weak && s.weak.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.72rem', color: ink.faint, marginBottom: 5, fontWeight: 700 }}>🔴 자주 틀리는 카드</div>
          {s.weak.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: '0.8rem', color: ink.body }}>
              <span style={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 800, color: semantic.danger, background: semantic.dangerTint, borderRadius: 999, padding: '1px 7px' }}>✕{w.wrong}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.q}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: '0.72rem', color: ink.faint }}>
        {s.dueNow > 0 ? `⏰ 지금 복습할 카드 ${s.dueNow}장` : '🎉 지금 당장 볼 카드는 없어요 — 잘하고 있어요!'}
      </div>
    </div>
  );
}

function Row({ c, label, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2.5px 0', fontSize: '0.82rem' }}>
      <span style={{ color: ink.muted }}>{label}</span>
      <span style={{ fontWeight: 800, color: c }}>{v}</span>
    </div>
  );
}

const BOX_C = [line.base, semantic.warnLine, semantic.warn, semantic.success, semantic.success, semantic.success];
const wrap = { background: surface.white, border: `1px solid ${line.base}`, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' };
const head = { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${surface.raised}` };
