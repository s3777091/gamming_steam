import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { alpha, useTheme, type SettingsTokens } from '@/theme';
import { UiContext, useUi } from '@/ui/scale';

export const SETTINGS_LAYOUT = {
  sidebarWidth: 248,
  navHeight: 46,
  rowHeight: 52,
  radius: 12,
  sectionSpacing: 20,
} as const;

const SettingsColors = createContext<SettingsTokens | null>(null);
const settingsScale = (value: number) => value;

/** Settings use fixed dp density instead of enlarging every control on tablets. */
export function SettingsSurface({ network, children }: { network: boolean; children: ReactNode }) {
  const ui = useUi();
  const { colors, settings } = useTheme();
  const compactUi = useMemo(() => ({ ...ui, scale: 1, s: settingsScale }), [ui]);
  const palette = useMemo<SettingsTokens>(() => {
    const accent = network ? settings.orange : settings.accent;
    return {
      ...settings,
      bg: colors.bg,
      sidebarBg: colors.panelSolid,
      card: colors.card,
      cardBorder: 'rgba(255, 255, 255, 0.07)',
      separator: 'rgba(255, 255, 255, 0.06)',
      inset: colors.bgDeep,
      accent,
      blue: accent,
      selectedBg: alpha(accent, 0.09),
      selectedBorder: alpha(accent, 0.18),
      selectedText: settings.text,
      textTertiary: 'rgba(255, 255, 255, 0.60)',
    };
  }, [colors, network, settings]);

  return (
    <UiContext.Provider value={compactUi}>
      <SettingsColors.Provider value={palette}>{children}</SettingsColors.Provider>
    </UiContext.Provider>
  );
}

export function useSettingsColors() {
  const scoped = useContext(SettingsColors);
  const { settings } = useTheme();
  return scoped ?? settings;
}
