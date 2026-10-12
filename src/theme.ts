// Token thiết kế của console ngang. Lấy từ các class Tailwind của
// src/components/game-library/* bên web (nền #080c12, thẻ #111821, nhấn #66a8ff).

export const colors = {
  bg: '#080c12',
  bgDeep: '#05080d',
  panel: '#0d1520',
  panelSolid: '#0a111c',
  card: '#111821',
  cardRaised: '#18202c',
  keyboardBg: '#0b1018',

  accent: '#66a8ff',
  accentSoft: '#8bbcff',
  accentGlow: '#9ac5ff',
  primary: '#1f6feb',
  primaryHover: '#388bfd',
  onAccent: '#06111f',

  white: '#ffffff',
  text: 'rgba(255,255,255,0.92)',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.52)',
  text4: 'rgba(255,255,255,0.38)',

  line: 'rgba(255,255,255,0.12)',
  lineStrong: 'rgba(255,255,255,0.22)',
  fillSoft: 'rgba(255,255,255,0.055)',
  fill: 'rgba(255,255,255,0.08)',
  fillStrong: 'rgba(255,255,255,0.14)',

  danger: '#f87171',
  dangerSoft: 'rgba(127,29,29,0.54)',
  success: '#4ade80',
  warning: '#fbbf24',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Kích thước thiết kế gốc: iPhone 14 Pro Max nằm ngang. Mọi số dp trong UI tính ở khung này. */
export const DESIGN = { width: 932, height: 430 } as const;
