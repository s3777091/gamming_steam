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

/**
 * Ngôn ngữ thiết kế Apple Liquid Glass (iOS 26):
 * Kính lỏng siêu trong suốt, khúc xạ ánh sáng đa chiều, viền sáng specular,
 * phản quang chuyển màu và chiều sâu phân tầng.
 */
export const glass = {
  // Kính trong chỉ dành cho controls nổi: tab, icon và nút tròn trên header.
  control: 'rgba(255, 255, 255, 0.085)',
  controlActive: 'rgba(255, 255, 255, 0.22)',
  controlOverlay: 'rgba(8, 12, 18, 0.08)',
  controlBorder: 'rgba(255, 255, 255, 0.24)',
  controlBorderActive: 'rgba(255, 255, 255, 0.46)',

  // Mép kính cho các thẻ ảnh: đủ hiện trên artwork nhưng không thành khung trắng đục.
  cardBorder: 'rgba(255, 255, 255, 0.20)',
  cardBorderActive: 'rgba(255, 255, 255, 0.52)',
  cardInnerEdge: 'rgba(255, 255, 255, 0.24)',

  // Bề mặt con nằm trong panel. Các lớp này chỉ nâng cấp phân cấp, không tự blur.
  surfaceUltraThin: 'rgba(255, 255, 255, 0.045)',
  surfaceThin: 'rgba(255, 255, 255, 0.07)',
  surface: 'rgba(255, 255, 255, 0.09)',
  surfaceRaised: 'rgba(18, 24, 34, 0.78)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.18)',

  // Panel chức năng phải tối và ổn định như một lớp vật liệu riêng, không phải kính trong.
  panel: 'rgba(7, 10, 16, 0.90)',
  modal: 'rgba(8, 11, 17, 0.88)',
  panelOverlay: 'rgba(5, 8, 13, 0.70)',
  scrim: 'rgba(2, 4, 8, 0.62)',
  floatingBar: 'rgba(9, 13, 20, 0.82)',

  // Viền panel kín đáo hơn viền kính của controls.
  border: 'rgba(255, 255, 255, 0.14)',
  borderSubtle: 'rgba(255, 255, 255, 0.10)',
  borderSpecular: 'rgba(255, 255, 255, 0.22)',
  panelBorder: 'rgba(255, 255, 255, 0.16)',
  borderAccent: 'rgba(102, 168, 255, 0.55)',

  // Ánh sáng phát quang & quầng màu (Ambient Glow)
  glowAccent: 'rgba(102, 168, 255, 0.35)',
  glowPrimary: 'rgba(31, 111, 235, 0.42)',
  glowSuccess: 'rgba(74, 222, 128, 0.35)',
  glowDanger: 'rgba(248, 113, 113, 0.35)',

  // Chiều sâu bóng đổ
  shadow: 'rgba(0, 0, 0, 0.35)',
  shadowSoft: 'rgba(0, 0, 0, 0.18)',
} as const;

export const glassShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.42,
  shadowRadius: 16,
  elevation: 8,
} as const;

export const glassShadowSubtle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 4,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Kích thước thiết kế gốc: iPhone 14 Pro Max nằm ngang. Mọi số dp trong UI tính ở khung này. */
export const DESIGN = { width: 932, height: 430 } as const;
