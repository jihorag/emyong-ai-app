import { palette, brand, ink, semantic } from '../styles/tokens';

export const SUBJECTS = [
  { id: 'korean',    stage: 1, title: '국어', short: '국어', icon: '📝', color: brand.primary, tax_key: '국어' },
  { id: 'math',      stage: 1, title: '수학', short: '수학', icon: '➗', color: brand.primaryInk, tax_key: '수학' },
  { id: 'society',   stage: 1, title: '사회', short: '사회', icon: '🌏', color: semantic.success, tax_key: '사회' },
  { id: 'science',   stage: 1, title: '과학', short: '과학', icon: '🔬', color: semantic.danger, tax_key: '과학' },
  { id: 'english',   stage: 1, title: '영어', short: '영어', icon: '🔤', color: semantic.warn, tax_key: '영어' },
  { id: 'moral',     stage: 1, title: '도덕', short: '도덕', icon: '⚖️', color: ink.muted, tax_key: '도덕' },
  { id: 'practical', stage: 1, title: '실과', short: '실과', icon: '🔧', color: brand.primaryDeep, tax_key: '실과' },
  { id: 'physical',  stage: 1, title: '체육', short: '체육', icon: '🤸', color: semantic.danger, tax_key: '체육' },
  { id: 'music',     stage: 1, title: '음악', short: '음악', icon: '🎵', color: semantic.success, tax_key: '음악' },
  { id: 'art',       stage: 1, title: '미술', short: '미술', icon: '🎨', color: semantic.danger, tax_key: '미술' },
  { id: 'integrate', stage: 1, title: '통합', short: '통합', icon: '🌈', color: palette.sky, tax_key: '통합' },
  { id: 'general',   stage: 1, title: '총론', short: '총론', icon: '📋', color: ink.body, tax_key: '총론' },
  { id: 'creative',  stage: 1, title: '창체', short: '창체', icon: '✨', color: brand.primaryInk, tax_key: '창체' },
];

export const getSubjectMeta = (id) => SUBJECTS.find((s) => s.id === id) || SUBJECTS[0];
