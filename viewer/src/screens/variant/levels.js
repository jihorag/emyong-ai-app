import { brand, surface } from '../../styles/tokens';

export const LEVELS = [
  { key: 'easy',   label: '쉬움', hint: '개념·용어 확인 (단답형)' },
  { key: 'normal', label: '보통', hint: '개념 적용·비교' },
  { key: 'hard',   label: '어려움', hint: '사례·복합 판단 (기출 수준)' },
];

export const levelTag = { display: 'inline-block', fontSize: '0.7rem', fontWeight: 800, background: surface.page, color: brand.primaryInk, padding: '2px 8px', borderRadius: 999 };
export const rubricBox = { background: surface.white, border: `1px solid ${surface.page}`, borderTop: `4px solid ${brand.primary}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
