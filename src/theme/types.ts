/** Mỗi theme có một id cố định; id này được lưu trên máy để mở app lần sau dùng lại. */
export type ThemeId = 'console' | 'noel' | 'halloween' | 'tet' | 'legend';

/** Màu nền tảng của console: bề mặt, màu nhấn, chữ, đường kẻ và trạng thái. */
export type Palette = {
  bg: string;
  bgDeep: string;
  panel: string;
  panelSolid: string;
  card: string;
  cardRaised: string;
  keyboardBg: string;
  /** Màu tối pha vào các lớp kính mờ (panel, modal, scrim, thanh nổi). */
  shade: string;

  accent: string;
  accentSoft: string;
  accentGlow: string;
  primary: string;
  primaryHover: string;
  /** Ba nấc tối dần của màu chính, cho gradient minh hoạ (thẻ PC, hình nền chờ). */
  primaryDeep: string;
  primaryDark: string;
  primaryNight: string;
  onAccent: string;

  white: string;
  text: string;
  text2: string;
  text3: string;
  text4: string;

  line: string;
  lineStrong: string;
  fillSoft: string;
  fill: string;
  fillStrong: string;

  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
};

/**
 * Ngôn ngữ thiết kế Apple Liquid Glass (iOS 26):
 * kính lỏng trong suốt, viền sáng specular và chiều sâu phân tầng.
 */
export type GlassTokens = {
  // Kính trong chỉ dành cho controls nổi: tab, icon và nút tròn trên header.
  control: string;
  controlActive: string;
  controlOverlay: string;
  controlBorder: string;
  controlBorderActive: string;

  // Mép kính cho các thẻ ảnh: đủ hiện trên artwork nhưng không thành khung trắng đục.
  cardBorder: string;
  cardBorderActive: string;
  cardInnerEdge: string;

  // Bề mặt con nằm trong panel. Các lớp này chỉ nâng cấp phân cấp, không tự blur.
  surfaceUltraThin: string;
  surfaceThin: string;
  surface: string;
  surfaceRaised: string;
  surfaceHighlight: string;

  // Panel chức năng phải tối và ổn định như một lớp vật liệu riêng, không phải kính trong.
  panel: string;
  modal: string;
  panelOverlay: string;
  scrim: string;
  floatingBar: string;

  // Viền panel kín đáo hơn viền kính của controls.
  border: string;
  borderSubtle: string;
  borderSpecular: string;
  panelBorder: string;
  borderAccent: string;

  // Ánh sáng phát quang & quầng màu (Ambient Glow)
  glowAccent: string;
  glowPrimary: string;
  glowSuccess: string;
  glowDanger: string;

  // Không khí của theme: quầng màu chính/nhấn trên nền các màn lớn và lớp ánh màu phủ lên ảnh nền game.
  ambient: string;
  ambientAccent: string;
  backdropTint: string;

  // Chiều sâu bóng đổ
  shadow: string;
  shadowSoft: string;
};

/** Bảng màu kiểu iOS của màn Cài đặt: khung master-detail, trạng thái chọn và màu hệ thống. */
export type SettingsTokens = {
  bg: string;
  sidebarBg: string;
  card: string;
  cardBorder: string;
  cardBorderSpecular: string;
  separator: string;
  pressedBg: string;
  cardRaised: string;
  inset: string;

  accent: string;
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  chevron: string;

  blue: string;
  green: string;
  red: string;
  orange: string;
  yellow: string;
  purple: string;
  indigo: string;
  teal: string;
  pink: string;
  gray: string;
  switchOff: string;
};

/** Hạt nhỏ, mờ, nhiều lớp chiều sâu trôi trong nền. */
export type ParticleKind = 'snow' | 'embers' | 'petals' | 'motes';

/** Ánh sáng và không khí của nền: bokeh, sương, ánh trăng, vệt sáng. */
export type AmbienceKind = 'frost' | 'fog' | 'lanternGlow' | 'goldSheen';

/**
 * Lớp trang trí của theme. Nằm trong nền của các màn lớn (sau nội dung, trên ảnh nền),
 * không đè lên control và không nhận chạm.
 */
export type ThemeDecorSpec = {
  particles: ParticleKind | null;
  ambience: AmbienceKind | null;
};

export type Theme = {
  id: ThemeId;
  /** Tên hiển thị trong Cài đặt → Giao diện. */
  label: string;
  /** Một dòng mô tả ngắn dưới tên theme. */
  detail: string;
  colors: Palette;
  glass: GlassTokens;
  settings: SettingsTokens;
  decor: ThemeDecorSpec;
};
