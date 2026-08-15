import { ink } from '../styles/tokens';
export default function HubHeader({ title, sub, onBack }) {
  return (
    <header className="top-nav" style={{ justifyContent: 'flex-start', gap: 10, alignItems: 'center' }}>
      {onBack && <button onClick={onBack} aria-label="뒤로" style={backBtn}>←</button>}
      <div>
        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: ink.strongest }}>{title}</div>
        {sub && <div style={{ fontSize: '0.78rem', color: ink.faint }}>{sub}</div>}
      </div>
    </header>
  );
}

const backBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '1.3rem', color: ink.muted, padding: 0,
};
