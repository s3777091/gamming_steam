// Cài đặt → Giao diện: chọn theme cho toàn bộ app. Theme áp dụng ngay và được lưu trên máy này.

import { forwardRef, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';

import { playUiSound } from '@/features/sound/UiSoundProvider';
import { useTheme, useThemeControl, type Theme, type ThemeId, type ThemeTransitionOrigin } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { rowStyle, SettingsGroup, ToggleRow } from './controls';

/** Ô xem trước: nền, dải màu chính và chấm màu nhấn của theme. */
const ThemeSwatch = forwardRef<View, { theme: Theme }>(function ThemeSwatch({ theme }, ref) {
  const { s } = useUi();
  const { colors } = theme;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: s(52),
        height: s(34),
        borderRadius: s(9),
        overflow: 'hidden',
        backgroundColor: colors.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.22)',
      }}
    >
      <LinearGradient
        colors={[colors.primaryDeep, colors.primaryNight, colors.bg]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: 'absolute',
          left: s(6),
          bottom: s(6),
          width: s(22),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: colors.primary,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: s(6),
          top: s(6),
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
});

function ThemeRow({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: (id: ThemeId, origin?: ThemeTransitionOrigin) => void;
}) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const swatch = useRef<View>(null);

  // Giọt màu của theme mới rơi đúng vào ô xem trước vừa bấm.
  const select = () => {
    const node = swatch.current;
    if (!node) return onSelect(theme.id);
    node.measureInWindow((x, y, width, height) => {
      onSelect(theme.id, width > 0 ? { x: x + width / 2, y: y + height / 2 } : undefined);
    });
  };

  return (
    <Press
      onPress={select}
      pressScale={0.995}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`Theme ${theme.label}`}
      style={rowStyle(s, { minHeight: s(54) })}
    >
      <ThemeSwatch ref={swatch} theme={theme} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={13.2} weight={active ? 'semibold' : 'regular'} color={appleColors.text}>
          {theme.label}
        </T>
        <T size={10.4} color={appleColors.textTertiary} numberOfLines={1} style={{ marginTop: s(1.5) }}>
          {theme.detail}
        </T>
      </View>
      {active ? <Check size={s(16)} color={appleColors.accent} strokeWidth={2.6} /> : null}
    </Press>
  );
}

export function AppearancePage() {
  const { themeId, setThemeId, themes, decorEnabled, setDecorEnabled } = useThemeControl();
  const select = (id: ThemeId, origin?: ThemeTransitionOrigin) =>
    setThemeId(id, { origin, onImpact: () => playUiSound('transition') });

  return (
    <>
      <SettingsGroup title="Theme" footer="Theme áp dụng ngay cho toàn bộ ứng dụng và được lưu trên máy này.">
        {themes.map((theme) => (
          <ThemeRow key={theme.id} theme={theme} active={theme.id === themeId} onSelect={select} />
        ))}
      </SettingsGroup>
      <SettingsGroup footer="Tuyết, sương, hoa rơi và ánh sáng nền theo từng theme. Không hiện khi đang stream.">
        <ToggleRow
          label="Hiệu ứng trang trí"
          detail="Hiệu ứng nhẹ phía sau giao diện"
          checked={decorEnabled}
          onChange={setDecorEnabled}
        />
      </SettingsGroup>
    </>
  );
}
