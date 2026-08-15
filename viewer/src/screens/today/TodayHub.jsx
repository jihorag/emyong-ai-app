import { useState, useMemo } from 'react';
import { getRecommendations, getRecentUnits, searchUnits } from '../../data/recommend';
import { brand, ink, line, surface, semantic, shadow } from '../../styles/tokens';

export default function TodayHub({ leavesBySubject, onPickUnit }) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const recs = useMemo(() => getRecommendations(leavesBySubject), [leavesBySubject]);
  const recent = useMemo(() => getRecentUnits(leavesBySubject), [leavesBySubject]);
  const results = useMemo(() => searchUnits(leavesBySubject, q), [leavesBySubject, q]);

  if (searching) {
    return (
      <div className="app-container">
        <TopBar onBack={() => { setSearching(false); setQ(''); }} />
        <main className="main-content" style={{ paddingTop: 8 }}>
          <SearchField value={q} onChange={setQ} focused autoFocus placeholder="단원 검색" />

          {!q && recent.length > 0 && (
            <Section label="최근 본 단원">
              {recent.map((u) => <UnitRow key={u.id} unit={u} onClick={() => onPickUnit?.(u)} />)}
            </Section>
          )}

          {q && (
            <Section label="검색 결과">
              {results.length
                ? results.map((u) => <UnitRow key={u.id} unit={u} onClick={() => onPickUnit?.(u)} />)
                : <Empty>"{q}" 와 맞는 단원이 없어요</Empty>}
            </Section>
          )}

          {!q && recent.length === 0 && (
            <Empty>단원 이름을 입력해 보세요. 전 과목에서 찾아드려요.</Empty>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <TopBar right="나를 위한 학습" />
      <main className="main-content" style={{ paddingTop: 8 }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <img src="/imyong.png" alt="이묭이"
            style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <span style={bubble}>오늘 공부하고 싶은 단원이 있나요?</span>
        </div>

        <button onClick={() => setSearching(true)} style={{ ...searchBox, cursor: 'pointer' }}>
          <SearchIcon />
          <span style={{ color: ink.faint, fontSize: '0.88rem' }}>단원을 입력하거나 아래에서 골라보세요</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '22px 2px 10px' }}>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: ink.strongest }}>이묭이 추천</span>
          {recs.length > 0 && <span style={{ fontSize: '0.76rem', color: ink.faint, fontWeight: 600 }}>지금 딱 좋아요</span>}
        </div>

        {recs.length === 0 ? (
          <Empty>단원 불러오는 중…</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((r, i) => (
              <RecCard key={r.unit.id} rec={r} primary={i === 0} onClick={() => onPickUnit?.(r.unit)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TopBar({ right, onBack }) {
  return (
    <header className="top-nav" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: ink.muted, padding: 0 }}>←</button>
        )}
        <span style={{ color: brand.primary, fontSize: '0.9rem' }}>◈</span>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: ink.strongest }}>AI 추천</span>
      </div>
      {right && <span style={{ fontSize: '0.78rem', color: ink.faint, fontWeight: 600 }}>{right}</span>}
    </header>
  );
}

function SearchField({ value, onChange, focused, autoFocus, placeholder }) {
  return (
    <div style={{ ...searchBox, ...(focused ? searchBoxFocused : null) }}>
      <SearchIcon />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.88rem', color: ink.body, minWidth: 0 }}
      />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ink.faint} strokeWidth="2.2"
      strokeLinecap="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function Section({ label, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ fontSize: '0.78rem', color: ink.muted, fontWeight: 700, margin: '0 2px 8px' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

function RecCard({ rec, primary, onClick }) {
  const { unit, reason, tone } = rec;
  return (
    <button onClick={onClick} style={card}>
      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: '0.98rem', color: ink.strongest }}>{unit.title}</span>
        <span style={{ ...tagBase, ...TONE[tone], marginTop: 7 }}>{reason}</span>
      </span>
      {primary ? <span style={goCircle}>→</span> : <span style={{ color: ink.faint, fontSize: '1.1rem', flexShrink: 0 }}>›</span>}
    </button>
  );
}

function UnitRow({ unit, onClick }) {
  return (
    <button onClick={onClick} style={{ ...card, padding: '13px 16px' }}>
      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', color: ink.strongest }}>{unit.title}</span>
        <span style={{ display: 'block', fontSize: '0.74rem', color: ink.faint, marginTop: 3 }}>
          {unit.path.slice(0, 2).join(' · ')}
        </span>
      </span>
      <span style={{ color: ink.faint, fontSize: '1.1rem', flexShrink: 0 }}>›</span>
    </button>
  );
}

function Empty({ children }) {
  return (
    <div style={{ padding: '26px 20px', textAlign: 'center', color: ink.faint, fontSize: '0.84rem', lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

const bubble = {
  background: brand.tint, color: ink.body, fontSize: '0.88rem', fontWeight: 600,
  padding: '11px 18px', borderRadius: 999,
};

const searchBox = {
  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 12,
  padding: '13px 15px', boxShadow: shadow.sm, textAlign: 'left',
};
const searchBoxFocused = { border: `1.5px solid ${brand.primary}`, boxShadow: shadow.md };

const card = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
  background: surface.card, border: `1px solid ${line.base}`, borderRadius: 14,
  padding: '15px 16px', boxShadow: shadow.sm, cursor: 'pointer',
};

const tagBase = {
  display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
  padding: '3px 9px', borderRadius: 999,
};
const TONE = {
  danger:  { background: semantic.dangerTint, color: semantic.danger },
  brand:   { background: brand.tint, color: brand.primaryDeep },
  neutral: { background: surface.sunken, color: ink.muted },
};

const goCircle = {
  width: 32, height: 32, borderRadius: 999, flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: brand.primary, color: ink.onBrand, fontWeight: 800, fontSize: '0.95rem',
};
