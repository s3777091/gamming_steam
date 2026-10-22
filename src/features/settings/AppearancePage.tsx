// Cài đặt → Giao diện: chọn theme cho toàn bộ app. Theme áp dụng ngay và được lưu trên máy này.

import { forwardRef, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';

import { playUiSound } from '@/features/sound/UiSoundProvider';
import { useThemeControl, type Theme, type ThemeId, type ThemeTransitionOrigin } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { rowStyle, SettingsGroup, ToggleRow } from './controls';
import { AppearancePreview } from './AppearancePreview';
import { useSettingsColors } from './SettingsSurface';

/** Ô xem trước: nền, dải màu chính và chấm màu nhấn của theme. */
const ThemeSwatch = forwardRef<View, { theme: Theme }>(function ThemeSwatch({ theme }, ref) {
  const { s } = useUi();
  const { colors, glass, material } = theme;
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
        borderColor: glass.cardBorder,
      }}
    >
      <LinearGradient
        colors={[colors.primaryDeep, colors.primaryNight, colors.bg]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={material.activeSheen} style={StyleSheet.absoluteFill} />
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
  const appleColors = useSettingsColors();
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
      // Đổi theme đã có tiếng huýt + bloop của giọt màu; tiếng click sẽ nuốt mất tiếng huýt.
      sound={active ? 'select' : false}
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
          {theme.material.label} · {theme.detail}
        </T>
      </View>
      {active ? <Check size={s(16)} color={appleColors.accent} strokeWidth={2.6} /> : null}
    </Press>
  );
}

export function AppearancePage() {
  const { themeId, setThemeId, themes, decorEnabled, setDecorEnabled } = useThemeControl();
  // Dấu tích nhảy sang hàng vừa bấm ngay lập tức; theme thật chỉ đổi khi giọt màu phủ kín.
  const [picked, setPicked] = useState<ThemeId | null>(null);
  if (picked !== null && picked === themeId) setPicked(null);
  const shownId = picked ?? themeId;
  useEffect(() => {
    if (picked === null) return;
    // Yêu cầu bị bỏ qua (đang chạy hiệu ứng khác): trả dấu tích về theme thật.
    const timer = setTimeout(() => setPicked(null), 2500);
    return () => clearTimeout(timer);
  }, [picked]);
  const select = (id: ThemeId, origin?: ThemeTransitionOrigin) => {
    if (id !== themeId) setPicked(id);
    setThemeId(id, {
      origin,
      onStart: () => playUiSound('themeFall'),
      onImpact: () => playUiSound('themeSplash'),
    });
  };

  return (
    <>
      <SettingsGroup title="Theme" footer="Theme áp dụng ngay cho toàn bộ ứng dụng và được lưu trên máy này.">
        {themes.map((theme) => (
          <ThemeRow key={theme.id} theme={theme} active={theme.id === shownId} onSelect={select} />
        ))}
      </SettingsGroup>
      <SettingsGroup title="Xem trước" footer="Xem chất liệu, khung avatar và màn chờ của theme hiện tại. Xem thử không mở game hay kết nối máy tính.">
        <AppearancePreview />
      </SettingsGroup>
      <SettingsGroup footer="Cảnh nền, hạt trôi, vân bề mặt, khung avatar và hiệu ứng chọn theo mùa. Không hiện khi đang chơi game.">
        <ToggleRow
          label="Hiệu ứng trang trí"
          detail="Dấu ấn mùa của theme đang dùng"
          checked={decorEnabled}
          onChange={setDecorEnabled}
        />
      </SettingsGroup>
    </>
  );
}
