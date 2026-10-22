import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import { FocusLayer } from '@/features/gamepad/focus';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export const mappingColors = {
  bg: '#101018',
  panel: '#171620',
  panelSolid: '#181726',
  raised: '#211e30',
  card: '#161524',
  border: '#343044',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderAccent: 'rgba(167, 122, 255, 0.35)',
  text: '#f5f3fc',
  muted: '#aaa5be',
  mutedLight: '#c5c0d8',
  accent: '#a77aff',
  accentSoft: 'rgba(167, 122, 255, 0.15)',
  primary: '#7946e8',
  primaryGlow: 'rgba(121, 70, 232, 0.35)',
  selected: '#30224d',
  success: '#61d398',
  danger: '#ff8998',
  // Gamepad button accents
  btnA: '#34d399',
  btnB: '#fb7185',
  btnX: '#38bdf8',
  btnY: '#fbbf24',
};

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'glass';

export function MappingButton({ children, onPress, disabled, active, danger, label, variant = 'default', autoFocus, style }: {
  children: ReactNode; onPress: () => void; disabled?: boolean; active?: boolean; danger?: boolean;
  label?: string; variant?: ButtonVariant; autoFocus?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [hover] = useState(() => new Animated.Value(0));
  useEffect(() => () => hover.stopAnimation(), [hover]);
  const highlight = (toValue: number) => {
    Animated.timing(hover, { toValue, duration: reduceMotion ? 0 : 140, useNativeDriver: true, isInteraction: false }).start();
  };

  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isGlass = variant === 'glass';

  const bgColor = isPrimary
    ? mappingColors.primary
    : isGhost
      ? (active ? mappingColors.selected : 'transparent')
      : isGlass
        ? (active ? 'rgba(121, 70, 232, 0.28)' : 'rgba(25, 23, 38, 0.85)')
        : active
          ? mappingColors.selected
          : mappingColors.raised;

  const borderColor = danger
    ? mappingColors.danger
    : isPrimary
      ? 'rgba(255, 255, 255, 0.18)'
      : isGhost
        ? (active ? mappingColors.accent : 'transparent')
        : active
          ? mappingColors.accent
          : isGlass
            ? 'rgba(167, 122, 255, 0.22)'
            : mappingColors.border;

  return (
    <Press
      disabled={disabled}
      onPress={onPress}
      pressScale={1}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onHoverIn={() => highlight(1)}
      onHoverOut={() => highlight(0)}
      autoFocus={autoFocus}
      focusRadius={s(8)}
      focusVariant="card"
      style={[{
        minHeight: Math.max(38, s(28)),
        minWidth: isGhost ? undefined : 38,
        paddingHorizontal: s(10),
        paddingVertical: s(6),
        borderRadius: s(8),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: bgColor,
        borderWidth: 1,
        borderColor,
        opacity: disabled ? 0.38 : 1,
      }, style]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(8), backgroundColor: '#ffffff', opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }) }]} />
      {typeof children === 'string' || typeof children === 'number'
        ? <T size={10.5} weight="semibold" color={danger ? mappingColors.danger : isPrimary ? '#ffffff' : mappingColors.text} numberOfLines={1}>{children}</T>
        : children}
    </Press>
  );
}

export function MappingIconButton({ icon: Icon, onPress, label, active, disabled, danger, size = 15, style }: {
  icon: LucideIcon; onPress: () => void; label: string; active?: boolean; disabled?: boolean; danger?: boolean; size?: number; style?: StyleProp<ViewStyle>;
}) {
  const { s } = useUi();
  return (
    <MappingButton
      label={label}
      onPress={onPress}
      active={active}
      disabled={disabled}
      danger={danger}
      style={[{ width: Math.max(38, s(28)), minWidth: Math.max(38, s(28)), paddingHorizontal: 0, paddingVertical: 0 }, style]}>
      <Icon size={s(size)} color={danger ? mappingColors.danger : active ? mappingColors.accent : mappingColors.text} />
    </MappingButton>
  );
}

export function MappingDivider({ vertical = false }: { vertical?: boolean }) {
  const { s } = useUi();
  return <View style={vertical
    ? { width: 1, height: s(18), backgroundColor: mappingColors.border, marginHorizontal: s(3) }
    : { height: 1, width: '100%', backgroundColor: mappingColors.border, marginVertical: s(6) }} />;
}

export function MappingSegmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { s } = useUi();
  return (
    <View style={[{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0d0d14',
      borderRadius: s(9),
      padding: s(3),
      borderWidth: 1,
      borderColor: mappingColors.border,
      gap: s(3),
    }, style]}>
      {options.map(opt => {
        const selected = opt.key === value;
        const Icon = opt.icon;
        return (
          <Press
            key={opt.key}
            onPress={() => onChange(opt.key)}
            autoFocus={selected}
            focusRadius={s(7)}
            focusVariant="card"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(6),
              paddingVertical: s(6),
              paddingHorizontal: s(8),
              borderRadius: s(7),
              backgroundColor: selected ? mappingColors.primary : 'transparent',
              borderWidth: 1,
              borderColor: selected ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
            }}>
            {Icon ? <Icon size={s(13)} color={selected ? '#ffffff' : mappingColors.muted} /> : null}
            <T size={10} weight={selected ? 'semibold' : 'regular'} color={selected ? '#ffffff' : mappingColors.muted} numberOfLines={1}>
              {opt.label}
            </T>
          </Press>
        );
      })}
    </View>
  );
}

export function MappingCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { s } = useUi();
  return <View style={[{ padding: s(12), gap: s(8), borderRadius: s(12), borderWidth: 1, borderColor: mappingColors.border, backgroundColor: mappingColors.panel }, style]}>{children}</View>;
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
  return (
    <Modal transparent visible animationType="none" supportedOrientations={['portrait', 'landscape']} onRequestClose={() => close(onClose)}>
      <FocusLayer>
        <View style={[mappingStyles.modal, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }]}>
          <Pressable
            accessibilityLabel="Đóng hộp thoại"
            onPress={() => close(onClose)}
            focusable={false}
            accessible={false}
            importantForAccessibility="no"
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: s(wide ? 560 : 320),
              maxHeight: '100%',
              opacity: progress,
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            }}>
            {children}
          </Animated.View>
        </View>
      </FocusLayer>
    </Modal>
  );
}

export const mappingStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: 'rgba(5, 4, 12, 0.72)' },
});
