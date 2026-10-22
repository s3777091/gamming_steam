import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, View } from 'react-native';

import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { CONSOLE } from './consoleVisuals';

type ActionProps = Omit<ComponentProps<typeof Press>, 'children'> & {
  label: string;
  icon?: ReactNode;
  compact?: boolean;
};

/** One primary action treatment across all three console tabs. */
export function ConsoleAction({ label, icon, compact = false, style, disabled, ...props }: ActionProps) {
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [hover] = useState(() => new Animated.Value(0));
  useEffect(() => () => hover.stopAnimation(), [hover]);
  const highlight = (toValue: number) => {
    Animated.timing(hover, {
      toValue, duration: reduceMotion ? 0 : CONSOLE.hoverMs,
      useNativeDriver: true, isInteraction: false,
    }).start();
  };
  return (
    <Press sound="confirm" focusVariant="quiet" accessibilityLabel={label}
      {...props} disabled={disabled}
      onHoverIn={(event) => { highlight(1); props.onHoverIn?.(event); }}
      onHoverOut={(event) => { highlight(0); props.onHoverOut?.(event); }}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
        minWidth: s(compact ? 100 : 146), maxWidth: s(320), height: s(compact ? 36 : 44),
        paddingHorizontal: s(compact ? 14 : 22), gap: s(compact ? 7 : 10), borderRadius: s(12),
        backgroundColor: CONSOLE.action, borderWidth: 1, borderColor: CONSOLE.actionBorder,
        opacity: disabled ? 0.65 : 1,
      }, style]}>
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        borderRadius: s(12), backgroundColor: '#ffffff',
        opacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, 0.09] }),
      }} />
      {icon}
      <T size={compact ? 11 : 16} weight="semibold" color={CONSOLE.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T>
    </Press>
  );
}

export function ConsoleHints({ actionLabel, tabs = true }: { actionLabel: string; tabs?: boolean }) {
  const { s } = useUi();
  return (
    <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: s(22), height: s(30), paddingLeft: s(10) }}>
      {[{ key: 'A', label: actionLabel, color: CONSOLE.controllerA }, { key: 'B', label: 'Quay lại', color: CONSOLE.controllerB }].map((hint) => (
        <View key={hint.key} style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
          <View style={{ width: s(19), height: s(19), borderRadius: s(10), borderWidth: 1, borderColor: hint.color, alignItems: 'center', justifyContent: 'center' }}>
            <T size={10.5} weight="semibold" color={hint.color}>{hint.key}</T>
          </View>
          <T size={10} color={CONSOLE.muted}>{hint.label}</T>
        </View>
      ))}
      {tabs ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
        {['LB', 'RB'].map((key) => <View key={key} style={{ paddingHorizontal: s(5), height: s(18), borderRadius: s(4), borderWidth: 1, borderColor: CONSOLE.border, backgroundColor: CONSOLE.control, justifyContent: 'center' }}>
          <T size={9} color={CONSOLE.ink}>{key}</T>
        </View>)}
        <T size={10} color={CONSOLE.muted} style={{ marginLeft: s(4) }}>Chuyển tab</T>
      </View> : null}
    </View>
  );
}
