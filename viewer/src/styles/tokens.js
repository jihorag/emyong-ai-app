
// ⚠ 이 9색이 브랜드 정체성이다. 바꾸려면 팀 합의가 필요하다.
export const palette = {
  aliceBlue:   '#edf2fb',
  lavender1:   '#e2eafc',
  lavender2:   '#d7e3fc',
  lavender3:   '#ccdbfd',
  periwinkle1: '#c1d3fe',
  periwinkle2: '#b6ccfe',
  babyBlueIce: '#abc4ff',
  sky:         '#a3cef1',
  mist:        '#e7ecef',
};

export const brand = {
  primary:     '#5473b9',
  primaryDeep: '#435f9d',
  primaryInk:  '#4a6dba',
  tint:        palette.lavender2,
  tintSoft:    palette.aliceBlue,
};

export const ink = {
  strongest: '#2b3346',
  body:      '#3f495f',
  sub:       '#59637a',
  muted:     '#646f85',
  faint:     '#838ca1',
  onBrand:   '#ffffff',
};

export const line = {
  base:   palette.lavender2,
  soft:   palette.aliceBlue,
  strong: palette.periwinkle1,
  neutral: palette.mist,
};

export const surface = {
  page:    '#ffffff',
  card:    '#ffffff',
  raised:  palette.lavender1,
  sunken:  palette.mist,
  accent:  palette.lavender3,
  white:   '#ffffff',
};

export const semantic = {
  danger:      '#c74d3d',
  dangerTint:  '#f8f0ef',
  dangerLine:  '#ebcfcc',
  success:     '#328449',
  successTint: '#f0f7f2',
  successLine: '#cee8d6',
  warn:        '#9a6c27',
  warnTint:    '#f8f4ef',
  warnLine:    '#ecdfca',
};

export const gradient = {
  brand:  `linear-gradient(135deg, ${brand.primary}, ${brand.primaryDeep})`,
  soft:   `linear-gradient(160deg, ${palette.aliceBlue}, #ffffff)`,
  accent: `linear-gradient(135deg, ${palette.periwinkle1}, ${palette.babyBlueIce})`,
};

export const shadow = {
  sm: '0 1px 2px rgba(43, 51, 70, 0.06)',
  md: '0 4px 12px rgba(43, 51, 70, 0.08)',
  lg: '0 10px 24px rgba(43, 51, 70, 0.10)',
};
