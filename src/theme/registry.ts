import { consoleTheme } from './themes/console';
import { halloweenTheme } from './themes/halloween';
import { legendTheme } from './themes/legend';
import { noelTheme } from './themes/noel';
import { tetTheme } from './themes/tet';
import type { Theme, ThemeId } from './types';

/** Thứ tự ở đây là thứ tự hiện trong Cài đặt → Giao diện. */
export const THEMES: readonly Theme[] = [consoleTheme, noelTheme, halloweenTheme, tetTheme, legendTheme];

export const DEFAULT_THEME_ID: ThemeId = 'console';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? consoleTheme;
}
