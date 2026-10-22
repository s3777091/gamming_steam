import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { X, type LucideIcon } from 'lucide-react-native';

import type { UiSound } from '@/features/sound/UiSoundProvider';
import { useTheme } from '@/theme';
import { GlassBackdrop, MenuGlassBackdrop } from './GlassMaterial';
import { useMenuGlass } from './menuGlass';
import { Press } from './Press';
import { useUi } from './scale';
import { T } from './Text';

/** Tiêu đề và nút đóng chung cho menu game, panel chi tiết và Control Center. */
export function PanelHeader({ title, subtitle, leading, icon: Icon, action, onClose, divider = true, appearance = 'theme' }: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  onClose: () => void;
  divider?: boolean;
  appearance?: 'theme' | 'glass';
}) {
  const MENU_GLASS = useMenuGlass();
  const { colors, glass } = useTheme();
  const { s } = useUi();
  const neutral = appearance === 'glass';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), paddingHorizontal: s(16), paddingVertical: s(12),
      borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0, borderBottomColor: neutral ? MENU_GLASS.border : glass.borderSubtle }}>
      {leading ?? (Icon ? (
        <View style={{ width: s(30), height: s(30), borderRadius: s(9), alignItems: 'center', justifyContent: 'center',
          backgroundColor: neutral ? MENU_GLASS.inset : glass.surfaceHighlight, borderWidth: StyleSheet.hairlineWidth, borderColor: neutral ? MENU_GLASS.border : glass.borderAccent }}>
          <Icon size={s(16)} color={neutral ? MENU_GLASS.ink : colors.accentSoft} strokeWidth={1.9} />
        </View>
      ) : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="semibold" tracking={-0.025} color={colors.text} numberOfLines={1}>{title}</T>
        {subtitle ? <T size={10.5} color={colors.text3} numberOfLines={1} style={{ marginTop: s(2) }}>{subtitle}</T> : null}
      </View>
      {action}
      <PanelIconButton icon={X} label="Đóng" sound="back" appearance={appearance} onPress={onClose} />
    </View>
  );
}

/** Nút tròn chỉ có icon, cùng khuôn với nút đóng của tiêu đề (tải lại, sao chép...). */
export function PanelIconButton({ icon: Icon, label, onPress, appearance = 'theme', sound, disabled, autoFocus }: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  appearance?: 'theme' | 'glass';
  sound?: UiSound | false;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const MENU_GLASS = useMenuGlass();
  const { colors, glass } = useTheme();
  const { s } = useUi();
  const neutral = appearance === 'glass';
  return (
    <Press onPress={onPress} sound={sound} accessibilityLabel={label} disabled={disabled} autoFocus={autoFocus}
      focusVariant={neutral ? 'quiet' : 'auto'}
      style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1,
        backgroundColor: neutral ? 'transparent' : glass.control, borderWidth: 1, borderColor: neutral ? MENU_GLASS.border : glass.controlBorder }}>
      {neutral ? <MenuGlassBackdrop variant="control" radius={s(16)} /> : <GlassBackdrop material="control" radius={s(16)} />}
      <Icon size={s(15)} color={colors.text2} strokeWidth={1.8} />
    </Press>
  );
}
