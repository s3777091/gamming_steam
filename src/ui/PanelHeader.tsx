import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { X, type LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/theme';
import { GlassBackdrop } from './GlassMaterial';
import { Press } from './Press';
import { useUi } from './scale';
import { T } from './Text';

/** Tiêu đề và nút đóng chung cho menu game, panel chi tiết và Control Center. */
export function PanelHeader({ title, subtitle, leading, icon: Icon, action, onClose, divider = true }: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  onClose: () => void;
  divider?: boolean;
}) {
  const { colors, glass } = useTheme();
  const { s } = useUi();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), paddingHorizontal: s(16), paddingVertical: s(12),
      borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0, borderBottomColor: glass.borderSubtle }}>
      {leading ?? (Icon ? (
        <View style={{ width: s(30), height: s(30), borderRadius: s(9), alignItems: 'center', justifyContent: 'center',
          backgroundColor: glass.surfaceHighlight, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.borderAccent }}>
          <Icon size={s(16)} color={colors.accentSoft} strokeWidth={1.9} />
        </View>
      ) : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="semibold" tracking={-0.025} color={colors.text} numberOfLines={1}>{title}</T>
        {subtitle ? <T size={10.5} color={colors.text3} numberOfLines={1} style={{ marginTop: s(2) }}>{subtitle}</T> : null}
      </View>
      {action}
      <Press onPress={onClose} sound="back" accessibilityLabel="Đóng"
        style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center',
          backgroundColor: glass.control, borderWidth: 1, borderColor: glass.controlBorder }}>
        <GlassBackdrop material="control" radius={s(16)} />
        <X size={s(15)} color={colors.text2} strokeWidth={1.8} />
      </Press>
    </View>
  );
}
