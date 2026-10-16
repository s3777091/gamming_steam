import { alpha, mix } from './color';
import { createMaterial } from './material';
import type { GlassTokens, MaterialKind, Palette, SettingsTokens, Theme, ThemeDecorSpec, ThemeId } from './types';

/** Các màu một theme bắt buộc khai báo; mọi token còn lại tự suy ra từ đây. Viết ở dạng hex. */
export type ThemeSeed = Pick<
  Palette,
  | 'bg'
  | 'bgDeep'
  | 'panel'
  | 'panelSolid'
  | 'card'
  | 'cardRaised'
  | 'keyboardBg'
  | 'shade'
  | 'accent'
  | 'accentSoft'
  | 'accentGlow'
  | 'primary'
  | 'primaryHover'
  | 'onAccent'
>;

export type ThemeSpec = {
  id: ThemeId;
  label: string;
  detail: string;
  seed: ThemeSeed;
  material?: MaterialKind;
  /** Trang trí kèm theo theme; bỏ trống = không trang trí. */
  decor?: ThemeDecorSpec;
  /** Ghi đè từng token khi giá trị suy ra chưa đúng ý. */
  overrides?: {
    colors?: Partial<Palette>;
    glass?: Partial<GlassTokens>;
    settings?: Partial<SettingsTokens>;
  };
};

/**
 * Dựng một theme đầy đủ từ vài màu gốc. Thêm theme mới = viết một file trong `themes/`
 * gọi hàm này, rồi đăng ký nó trong `registry.ts`.
 */
export function createTheme({ id, label, detail, seed, material: materialKind = 'glass', decor = { particles: null, ambience: null }, overrides = {} }: ThemeSpec): Theme {
  const colors: Palette = {
    ...seed,
    primaryDeep: mix(seed.primary, '#000000', 0.25),
    primaryDark: mix(seed.primary, '#000000', 0.6),
    primaryNight: mix(seed.primary, '#000000', 0.88),
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
    ...overrides.colors,
  };

  const material = createMaterial(materialKind, colors);
  const seasonal = materialKind !== 'glass';
  const edge = material.frame[0];
  const glass: GlassTokens = {
    control: 'rgba(255, 255, 255, 0.085)',
    controlActive: 'rgba(255, 255, 255, 0.22)',
    controlOverlay: alpha(colors.shade, 0.08),
    controlBorder: 'rgba(255, 255, 255, 0.24)',
    controlBorderActive: 'rgba(255, 255, 255, 0.46)',

    cardBorder: 'rgba(255, 255, 255, 0.20)',
    cardBorderActive: 'rgba(255, 255, 255, 0.52)',
    cardInnerEdge: 'rgba(255, 255, 255, 0.24)',

    surfaceUltraThin: 'rgba(255, 255, 255, 0.045)',
    surfaceThin: 'rgba(255, 255, 255, 0.07)',
    surface: 'rgba(255, 255, 255, 0.09)',
    surfaceRaised: alpha(colors.cardRaised, 0.78),
    surfaceHighlight: 'rgba(255, 255, 255, 0.18)',

    panel: alpha(colors.shade, 0.9),
    modal: alpha(colors.shade, 0.88),
    panelOverlay: alpha(colors.shade, 0.7),
    scrim: alpha(colors.bgDeep, 0.62),
    floatingBar: alpha(colors.shade, 0.82),

    border: 'rgba(255, 255, 255, 0.14)',
    borderSubtle: 'rgba(255, 255, 255, 0.10)',
    borderSpecular: 'rgba(255, 255, 255, 0.22)',
    panelBorder: 'rgba(255, 255, 255, 0.16)',
    borderAccent: alpha(colors.accent, 0.55),

    glowAccent: alpha(colors.accent, 0.35),
    glowPrimary: alpha(colors.primary, 0.42),
    glowSuccess: 'rgba(74, 222, 128, 0.35)',
    glowDanger: 'rgba(248, 113, 113, 0.35)',

    ambient: alpha(colors.primary, 0.32),
    ambientAccent: alpha(colors.accent, 0.16),
    backdropTint: alpha(colors.primary, 0.22),

    shadow: 'rgba(0, 0, 0, 0.35)',
    shadowSoft: 'rgba(0, 0, 0, 0.18)',
    ...(seasonal ? {
      control: alpha(colors.cardRaised, 0.72),
      controlActive: alpha(colors.accent, 0.2),
      controlOverlay: alpha(colors.panelSolid, materialKind === 'frost' ? 0.3 : 0.72),
      controlBorder: alpha(colors.accentSoft, 0.36),
      controlBorderActive: alpha(colors.accentGlow, 0.78),
      cardBorder: alpha(colors.accent, 0.38),
      cardBorderActive: alpha(colors.accentGlow, 0.88),
      cardInnerEdge: alpha(edge, 0.3),
      surfaceUltraThin: alpha(colors.card, 0.52),
      surfaceThin: alpha(colors.card, 0.66),
      surface: alpha(colors.card, 0.82),
      surfaceHighlight: alpha(colors.accentSoft, 0.16),
      panel: alpha(colors.panelSolid, 0.96),
      modal: alpha(colors.panelSolid, 0.97),
      panelOverlay: alpha(colors.panelSolid, 0.88),
      floatingBar: alpha(colors.panelSolid, 0.94),
      border: alpha(colors.accentSoft, 0.22),
      borderSubtle: alpha(colors.accentSoft, 0.14),
      borderSpecular: alpha(colors.accentGlow, 0.38),
      panelBorder: alpha(colors.accentSoft, 0.25),
    } : {}),
    ...overrides.glass,
  };

  const settings: SettingsTokens = {
    bg: colors.bg,
    sidebarBg: alpha(colors.panelSolid, 0.82),
    card: 'rgba(255, 255, 255, 0.045)',
    cardBorder: 'rgba(255, 255, 255, 0.09)',
    cardBorderSpecular: 'rgba(255, 255, 255, 0.20)',
    separator: 'rgba(255, 255, 255, 0.065)',
    pressedBg: 'rgba(255, 255, 255, 0.08)',
    cardRaised: alpha(colors.cardRaised, 0.75),
    inset: alpha(colors.bgDeep, 0.5),

    // Màu nhấn của Cài đặt đi theo nút chính của theme.
    accent: colors.primary,
    selectedBg: 'rgba(255, 255, 255, 0.12)',
    selectedBorder: 'rgba(255, 255, 255, 0.20)',
    selectedText: '#ffffff',

    text: 'rgba(255, 255, 255, 0.95)',
    textSecondary: 'rgba(255, 255, 255, 0.60)',
    textTertiary: 'rgba(255, 255, 255, 0.42)',
    chevron: 'rgba(255, 255, 255, 0.32)',

    // `blue` là màu nhấn của các control trong Cài đặt (switch, slider, tick).
    blue: colors.primary,
    green: '#34c759',
    red: '#ff453a',
    orange: '#ff9f0a',
    yellow: '#ffd60a',
    purple: '#bf5af2',
    indigo: '#5e5ce6',
    teal: '#40c8e0',
    pink: '#ff375f',
    gray: '#8e8e93',
    switchOff: 'rgba(255, 255, 255, 0.16)',
    ...(seasonal ? {
      card: glass.surfaceThin,
      cardBorder: glass.border,
      cardBorderSpecular: glass.borderSpecular,
      separator: glass.borderSubtle,
      pressedBg: glass.surfaceHighlight,
      selectedBg: alpha(colors.accent, 0.14),
      selectedBorder: glass.borderAccent,
    } : {}),
    ...overrides.settings,
  };

  return { id, label, detail, colors, material, glass, settings, decor };
}
