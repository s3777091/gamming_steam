// Điểm vào duy nhất của hệ thống giao diện. Màu luôn lấy qua useTheme()/makeStyles để
// đổi theme lúc đang chạy; token tĩnh (font, bóng đổ, khung thiết kế) import trực tiếp.

export { alpha, mix } from './color';
export { createTheme, type ThemeSeed, type ThemeSpec } from './createTheme';
export { ThemeDecor } from './decor/ThemeDecor';
export { DEFAULT_THEME_ID, getTheme, isThemeId, THEMES } from './registry';
export { DESIGN, fonts, glassShadow, glassShadowSubtle } from './static';
export { makeStyles, ThemeProvider, useDecorEnabled, useTheme, useThemeControl, type ThemeChangeOptions } from './ThemeProvider';
export type { ThemeTransitionOrigin } from './ThemeTransition';
export type { AmbienceKind, GlassTokens, Palette, ParticleKind, SettingsTokens, Theme, ThemeDecorSpec, ThemeId } from './types';
