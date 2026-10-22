import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export const mappingColors = {
  bg: '#101018', panel: '#171620', raised: '#211e30', border: '#343044',
  text: '#f5f3fc', muted: '#aaa5be', accent: '#a77aff', primary: '#7946e8',
  selected: '#30224d', success: '#61d398', danger: '#ff8998',
};

export function MappingButton({ children, onPress, disabled, active, danger, label, style }: {
  children: ReactNode; onPress: () => void; disabled?: boolean; active?: boolean; danger?: boolean;
  label?: string; style?: StyleProp<ViewStyle>;
}) {
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [hover] = useState(() => new Animated.Value(0));
  useEffect(() => () => hover.stopAnimation(), [hover]);
  const highlight = (toValue: number) => {
    Animated.timing(hover, { toValue, duration: reduceMotion ? 0 : 140, useNativeDriver: true, isInteraction: false }).start();
  };
  return <Press disabled={disabled} onPress={onPress} pressScale={1} accessibilityLabel={label}
    accessibilityState={{ selected: active }} onHoverIn={() => highlight(1)} onHoverOut={() => highlight(0)}
    style={[{ minHeight: Math.max(40, s(30)), minWidth: 40, paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(7),
      justifyContent: 'center', alignItems: 'center', backgroundColor: active ? mappingColors.selected : mappingColors.raised,
      borderWidth: 1, borderColor: danger ? mappingColors.danger : active ? mappingColors.accent : mappingColors.border, opacity: disabled ? 0.4 : 1 }, style]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(7), backgroundColor: '#ffffff', opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] }) }]} />
    {typeof children === 'string' || typeof children === 'number'
      ? <T size={10.5} weight="semibold" color={danger ? mappingColors.danger : mappingColors.text} numberOfLines={1}>{children}</T>
      : children}
  </Press>;
}
export function MappingCard({ children }: { children: ReactNode }) {
  const { s } = useUi();
  return <View style={{ padding: s(10), gap: s(8), borderRadius: s(9), borderWidth: 1, borderColor: mappingColors.border, backgroundColor: mappingColors.panel }}>{children}</View>;
}
export function MappingStatus({ loading, error }: { loading?: boolean; error?: string | null }) {
  return <>{loading ? <ActivityIndicator color={mappingColors.accent} /> : null}{error ? <T accessibilityRole="alert" color={mappingColors.danger} size={11}>{error}</T> : null}</>;
}

export function useMappingTransition(duration: number) {
  const { reduceMotion } = useMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [duration, progress, reduceMotion]);
  return { progress, close: (onClose: () => void) => {
    Animated.timing(progress, { toValue: 0, duration: reduceMotion ? 0 : duration, useNativeDriver: true }).start(({ finished }) => { if (finished) onClose(); });
  } };
}

export function MappingModal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  const { s, insets } = useUi();
  const { progress, close } = useMappingTransition(180);
  return <Modal transparent visible animationType="none" supportedOrientations={['portrait', 'landscape']} onRequestClose={() => close(onClose)}>
    <View style={[mappingStyles.modal, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
      <Pressable accessibilityLabel="Đóng hộp thoại" onPress={() => close(onClose)} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={{ width: '100%', maxWidth: s(wide ? 520 : 306), maxHeight: '100%', opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>
    </View>
  </Modal>;
}
export const mappingStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(5,4,10,0.38)' },
});
