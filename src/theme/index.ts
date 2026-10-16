// Điểm vào duy nhất của hệ thống giao diện. Màu luôn lấy qua useTheme()/makeStyles để
// đổi theme lúc đang chạy; token tĩnh (font, bóng đổ, khung thiết kế) import trực tiếp.

export { alpha, mix } from './color';
export { createTheme, type ThemeSeed, type ThemeSpec } from './createTheme';
export { SeasonGlyphIcon } from './decor/glyph';
export { AvatarFrame, HeaderAccent, SeasonalIcon, SeasonGreeting, useSeason } from './decor/season';
export { ThemeDecor } from './decor/ThemeDecor';
export { MaterialTexture } from './decor/MaterialTexture';
export { SeasonScenery } from './decor/SeasonScenery';
export { CardSurface, LoadingSeasonScenery, SeasonalCorners, SurfaceSheen } from './decor/surfaces';
export { DEFAULT_THEME_ID, getTheme, isThemeId, THEMES } from './registry';
export { DESIGN, fonts, glassShadow, glassShadowSubtle } from './static';
export { makeStyles, ThemeProvider, useDecorEnabled, useTheme, useThemeControl, type ThemeChangeOptions } from './ThemeProvider';
export type { ThemeTransitionOrigin } from './ThemeTransition';
export type {
  AmbienceKind,
  DecorAsset,
  GlassTokens,
  MaterialKind,
  Palette,
  ParticleKind,
  SeasonGlyph,
  SeasonSpec,
  SettingsTokens,
  SurfaceTokens,
  Theme,
  ThemeDecorSpec,
  ThemeId,
} from './types';
