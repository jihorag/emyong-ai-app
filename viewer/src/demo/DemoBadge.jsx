import { useState } from 'react';
import { brand, ink, line, surface, shadow, semantic } from '../styles/tokens';
import { reseedDemo, emptyDemo, exitDemo } from './index';

export default function DemoBadge() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const run = async (label, fn) => {
    setBusy(label);
    await fn();
    window.location.reload();
  };

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} style={badge} aria-label="데모 모드">
        <span style={dot} />데모
      </button>
      {open && (
        <div style={panel}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: ink.strongest }}>데모 모드</div>
          <div style={{ fontSize: '0.76rem', color: ink.muted, lineHeight: 1.6, marginTop: 6 }}>
            학습 기록은 시연용으로 채워 넣은 값이고, AI 응답은 서버 없이 이 기기 안에서
            만들어집니다. 실제 사용자 데이터가 아닙니다.
          </div>
          <button onClick={() => run('채우는 중…', reseedDemo)} disabled={!!busy} style={{ ...panelBtn, ...panelBtnOn }}>
            {busy || '학습 기록 다시 채우기'}
          </button>
          <button onClick={() => run('비우는 중…', emptyDemo)} disabled={!!busy} style={panelBtn}>
            빈 상태로 보기 (첫 실행 화면)
          </button>
          <button onClick={() => run('돌아가는 중…', exitDemo)} disabled={!!busy}
            style={{ ...panelBtn, color: semantic.danger, borderColor: semantic.dangerLine }}>
            데모 끄고 원래 기록으로
          </button>
        </div>
      )}
    </>
  );
}

const badge = {
  position: 'fixed', bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))', left: 12, zIndex: 120,
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  padding: '6px 11px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
  background: surface.card, border: `1px solid ${line.strong}`, color: brand.primaryDeep,
  boxShadow: shadow.sm,
};
const dot = { width: 6, height: 6, borderRadius: '50%', background: semantic.success };

const panel = {
  position: 'fixed', bottom: 'calc(112px + env(safe-area-inset-bottom, 0px))', left: 12, zIndex: 120,
  width: 250, padding: '14px 15px 12px', borderRadius: 14,
  background: surface.card, border: `1px solid ${line.base}`, boxShadow: shadow.lg,
};
const panelBtn = {
  width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, cursor: 'pointer',
  fontSize: '0.8rem', fontWeight: 700,
  border: `1px solid ${line.base}`, background: surface.card, color: ink.muted,
};
const panelBtnOn = { background: brand.primary, borderColor: brand.primary, color: ink.onBrand };
