import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { T } from '@/ui/Text';

export function MappingButton({ children, onPress, disabled, active, danger }: { children: ReactNode; onPress: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  const { colors, glass } = useTheme();
  return <Press disabled={disabled} onPress={onPress} accessibilityRole="button" style={{ minHeight: 42, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: active ? colors.primary : glass.control, borderWidth: 1, borderColor: danger ? colors.danger : glass.controlBorder, opacity: disabled ? 0.4 : 1 }}>
    <T size={12} weight="semibold" color={danger ? colors.danger : colors.text}>{children}</T>
  </Press>;
}
export function MappingCard({ children }: { children: ReactNode }) {
  const { glass } = useTheme();
  return <View style={{ padding: 14, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: glass.controlBorder, overflow: 'hidden', backgroundColor: glass.panel }}><GlassBackdrop material="panel" />{children}</View>;
}
export function MappingStatus({ loading, error }: { loading?: boolean; error?: string | null }) {
  const { colors } = useTheme();
  return <>{loading ? <ActivityIndicator color={colors.accentSoft} /> : null}{error ? <T accessibilityRole="alert" color={colors.danger} size={12}>{error}</T> : null}</>;
}
export const mappingStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.65)' },
});
