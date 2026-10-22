import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, Play } from 'lucide-react-native';

import { FocusScroll, useSceneActive } from '@/features/gamepad/focus';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ConsoleAction, ConsoleHints } from './ConsoleControls';
import { CONSOLE, CONSOLE_CARD } from './consoleVisuals';

/** Desktop streaming uses the same hero, action and shelf rhythm as Games. */
export const PcView = memo(function PcView({ reachable, refreshing, error, onConnect }: {
  reachable: boolean;
  refreshing: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  const { s, width } = useUi();
  const { active, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1, duration: active && sceneActive && !reduceMotion ? CONSOLE.infoMs : 0,
      easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, enter, reduceMotion, sceneActive]);

  const label = reachable ? 'Kết nối máy tính' : 'Mở máy tính';
  const status = refreshing ? 'Đang kiểm tra máy tính…' : reachable ? 'Máy tính đã sẵn sàng' : 'Máy tính chưa kết nối';

  return (
    <View style={{ flex: 1 }}>
      <FocusScroll style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: s(10), paddingTop: s(8), paddingBottom: s(10) }}>
        <Animated.View style={{ alignItems: 'flex-start', gap: s(10), opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : s(8), 0] }) }] }}>
          <T size={Math.min(42, Math.max(28, width * 0.043 / 1.4))} weight="semibold" color={CONSOLE.ink} tracking={-0.04} leading={1.1}>
            Jetson PC
          </T>
          <T size={11} color={CONSOLE.muted}>Truy cập desktop · Cấu hình stream dùng chung với Games</T>
          <ConsoleAction label={label} onPress={onConnect} autoFocus
            icon={reachable ? <Play size={s(18)} color={CONSOLE.ink} fill={CONSOLE.ink} /> : <Monitor size={s(18)} color={CONSOLE.ink} />} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: reachable ? CONSOLE.controllerA : CONSOLE.muted }} />
            <T size={10} color={CONSOLE.muted}>{status}</T>
          </View>
        </Animated.View>
        {error && !reachable ? (
          <View style={{ marginTop: s(10), maxWidth: s(480), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(6),
            borderWidth: 1, borderColor: 'rgba(254,202,202,0.3)', backgroundColor: 'rgba(80,12,12,0.65)' }}>
            <T size={10.4} color="#fee2e2" leading={1.5}>{error}</T>
          </View>
        ) : null}
      </FocusScroll>

      <FocusScroll horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: s(CONSOLE_CARD.railHeight) }}
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: s(10), paddingVertical: s(12) }}
        accessibilityRole="list">
        <Press onPress={onConnect} focusRadius={s(CONSOLE_CARD.radius)} focusVariant="quiet" focusScale={1.05}
          pressScale={0.98} accessibilityLabel={`Jetson PC, ${status}`} accessibilityState={{ selected: true }}
          style={{ width: s(CONSOLE_CARD.width), height: s(CONSOLE_CARD.height), borderRadius: s(CONSOLE_CARD.radius) }}>
          <View style={{ flex: 1, overflow: 'hidden', borderRadius: s(CONSOLE_CARD.radius), borderWidth: 1,
            borderColor: CONSOLE.selectedBorder, backgroundColor: CONSOLE.card, justifyContent: 'center', alignItems: 'center', gap: s(5) }}>
            <LinearGradient colors={['#284d37', '#14281d', CONSOLE.background]}
              start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <Monitor size={s(25)} color={CONSOLE.ink} strokeWidth={1.5} />
            <T size={10} weight="semibold" color={CONSOLE.ink}>Jetson PC</T>
            <View style={{ position: 'absolute', right: s(8), top: s(8), width: s(6), height: s(6), borderRadius: s(3),
              backgroundColor: reachable ? CONSOLE.controllerA : CONSOLE.muted }} />
          </View>
        </Press>
      </FocusScroll>
      <ConsoleHints actionLabel={reachable ? 'Kết nối' : 'Mở PC'} />
    </View>
  );
});
