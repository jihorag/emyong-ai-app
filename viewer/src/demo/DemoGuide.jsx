import { brand, ink, line, surface, shadow } from '../styles/tokens';

export default function DemoGuide({ text, action, onAction }) {
  return (
    <div style={wrap}>
      <img src="/imyong.png" alt="이묭이" style={avatar} />
      <div style={bubble}>
        <span style={tail} />
        <div style={{ fontSize: '0.88rem', color: ink.body, lineHeight: 1.62 }}>{text}</div>
        {action && (
          <button onClick={onAction} style={cta}>{action} ›</button>
        )}
      </div>
    </div>
  );
}

const wrap = { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 };
const avatar = { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
const bubble = {
  position: 'relative', flex: 1, minWidth: 0,
  background: brand.tintSoft, border: `1px solid ${line.strong}`, borderRadius: 14,
  padding: '13px 15px', boxShadow: shadow.sm,
};
const tail = {
  position: 'absolute', left: -6, top: 15, width: 10, height: 10,
  background: brand.tintSoft, borderLeft: `1px solid ${line.strong}`, borderBottom: `1px solid ${line.strong}`,
  transform: 'rotate(45deg)',
};
const cta = {
  marginTop: 10, padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: brand.primary, color: surface.white, fontWeight: 800, fontSize: '0.82rem',
};
