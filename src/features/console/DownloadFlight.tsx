// Hiệu ứng bấm Tải: thẻ game thu nhỏ, gập vào thành một ô gọn, chờ PC nhận lệnh,
// rồi bay theo đường vòng lên chuông thông báo và hạ cánh ở đó (tại đây nó trở thành
// một mục tiến trình tải thật). PC từ chối lệnh thì ô mở ngược lại về chỗ cũ.
//
// Chỉ một phần tử nhỏ được animate nên dùng JS driver cho kích thước, góc bo và vị
// trí (native driver không làm được các thuộc tính bố cục).

import * as Haptics from 'expo-haptics';
import { Download } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { playUiSound } from '@/features/sound/UiSoundProvider';
import { alpha, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useUi } from '@/ui/scale';
import { useMotion } from '@/ui/motion';

export type FlightRect = { x: number; y: number; w: number; h: number };

export type Flight = {
  key: number;
  imageUrl: string | null;
  /** Vị trí thẻ game và chuông thông báo, tính theo gốc của lớp phủ. */
  from: FlightRect;
  to: FlightRect;
  /** null: chưa biết PC nhận lệnh hay chưa (ô chờ trên không). */
  result: 'ok' | 'fail' | null;
};

const FOLD_MS = 440;
const FLY_MS = 820;
const RING_MS = 560;
const ARC_POINTS = [0, 0.25, 0.5, 0.75, 1];
const GHOSTS = [0.2, 0.34, 0.5];

const haptic = (run: () => Promise<void>) => { void run().catch(() => {}); };

export function DownloadFlight({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const { reduceMotion, active } = useMotion();
  const { from, to } = flight;
  const [t] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [folded, setFolded] = useState(false);
  const doneRef = useRef(onDone);
  useLayoutEffect(() => { doneRef.current = onDone; }, [onDone]);

  const geometry = useMemo(() => {
    const tile = Math.min(s(60), from.h * 0.72);
    const target = Math.max(s(18), Math.min(to.w, to.h) * 0.78);
    const c0 = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const c1 = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    return { tile, target, c0, c1, arc: Math.max(s(46), Math.abs(c1.y - c0.y) * 0.35 + s(30)) };
  }, [from, s, to]);
  const { tile, target, c0, c1, arc } = geometry;

  // Gập: thẻ thu vào thành ô vuông.
  useEffect(() => {
    playUiSound('select');
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    const fold = Animated.timing(t, { toValue: 1, duration: reduceMotion ? 0 : FOLD_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false, isInteraction: false });
    fold.start(({ finished }) => { if (finished) setFolded(true); });
    return () => fold.stop();
  }, [reduceMotion, t]);

  // Chờ PC trả lời: ô nhấp nhô nhẹ trên không.
  useEffect(() => {
    if (!folded || flight.result || reduceMotion || !active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: false, isInteraction: false }),
      Animated.timing(bob, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: false, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, bob, flight.result, folded, reduceMotion]);

  useEffect(() => {
    if (!folded || !flight.result) return;
    bob.setValue(0);
    if (flight.result === 'fail') {
      const unfold = Animated.timing(t, { toValue: 0, duration: reduceMotion ? 0 : 320, easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false });
      unfold.start(({ finished }) => { if (finished) doneRef.current(); });
      return () => unfold.stop();
    }
    playUiSound('transition');
    const fly = Animated.timing(t, { toValue: 2, duration: reduceMotion ? 0 : FLY_MS, easing: Easing.bezier(0.55, 0, 0.2, 1), useNativeDriver: false, isInteraction: false });
    let landed: Animated.CompositeAnimation | null = null;
    fly.start(({ finished }) => {
      if (!finished) return;
      playUiSound('confirm');
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      landed = Animated.timing(ring, { toValue: 1, duration: reduceMotion ? 0 : RING_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
      landed.start(({ finished }) => { if (finished) doneRef.current(); });
    });
    return () => { fly.stop(); landed?.stop(); };
  }, [bob, flight.result, folded, reduceMotion, ring, t]);

  // Vị trí tâm đi theo cung parabol: lên cao rồi lao xuống chuông.
  const path = (point: (e: number) => number) => ({
    inputRange: [0, 1, ...ARC_POINTS.slice(1).map((e) => 1 + e)],
    outputRange: [point(0), point(0), ...ARC_POINTS.slice(1).map(point)],
  });
  const lerp = (a: number, b: number) => (e: number) => a + (b - a) * e;
  const cx = t.interpolate(path(lerp(c0.x, c1.x)));
  const cy = t.interpolate(path((e) => c0.y + (c1.y - c0.y) * e - arc * Math.sin(Math.PI * e)));
  const bobScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const width = t.interpolate({ inputRange: [0, 1, 2], outputRange: [from.w, tile, target] });
  const height = t.interpolate({ inputRange: [0, 1, 2], outputRange: [from.h, tile, target] });
  const left = Animated.subtract(cx, Animated.multiply(width, 0.5));
  const top = Animated.subtract(cy, Animated.multiply(height, 0.5));
  const radius = t.interpolate({ inputRange: [0, 1, 2], outputRange: [s(16), s(18), target / 2] });
  const rotateX = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '26deg', '0deg'], extrapolate: 'clamp' });
  const rotateY = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-34deg', '0deg'], extrapolate: 'clamp' });
  const spin = t.interpolate({ inputRange: [1, 2], outputRange: ['0deg', '360deg'], extrapolate: 'clamp' });
  const glyph = t.interpolate({ inputRange: [0.55, 1, 1.5, 1.9], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const rim = t.interpolate({ inputRange: [0, 0.8], outputRange: [0.2, 1], extrapolate: 'clamp' });
  const fade = t.interpolate({ inputRange: [1.9, 2], outputRange: [1, 0], extrapolate: 'clamp' });
  const ringSize = target * 2.6;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 90, elevation: 90 }]}>
      {GHOSTS.map((delay, index) => (
        <FlightTrail key={delay} source={t} lag={delay} size={target * (0.62 - index * 0.12)} c0={c0} c1={c1} arc={arc} opacity={0.4 - index * 0.1} />
      ))}

      <Animated.View
        style={[
          styles.tile,
          {
            left,
            top,
            width,
            height,
            borderRadius: radius,
            opacity: fade,
            transform: [{ perspective: 700 }, { rotateX }, { rotateY }, { rotateZ: spin }, { scale: bobScale }],
          },
        ]}
      >
        {flight.imageUrl ? <Img source={{ uri: flight.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,14,24,0.28)' }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.rim, { opacity: rim, borderRadius: radius }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.glyph, { opacity: glyph }]}>
          <View style={[styles.glyphDisc, { width: s(26), height: s(26), borderRadius: s(13) }]}>
            <Download size={s(14)} color={colors.white} strokeWidth={2.2} />
          </View>
        </Animated.View>
      </Animated.View>

      {/* Sóng lan ra ở chuông khi ô hạ cánh. */}
      <Animated.View
        style={[
          styles.ring,
          {
            left: c1.x - ringSize / 2,
            top: c1.y - ringSize / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }],
          },
        ]}
      />
    </View>
  );
}

/** Vệt sáng bám theo ô khi bay: cùng đường đi nhưng chậm hơn một nhịp. */
function FlightTrail({ source, lag, size, c0, c1, arc, opacity }: {
  source: Animated.Value;
  lag: number;
  size: number;
  c0: { x: number; y: number };
  c1: { x: number; y: number };
  arc: number;
  opacity: number;
}) {
  const styles = useStyles();
  // Lùi t một đoạn: ô bóng đi sau ô thật `lag` (tính theo đơn vị t, 0..1 là cả chuyến bay).
  const lagged = useMemo(() => Animated.subtract(source, lag), [lag, source]);
  const points = ARC_POINTS.slice(1);
  const input = [0, 1, ...points.map((e) => 1 + e)];
  const x = lagged.interpolate({ inputRange: input, outputRange: [c0.x, c0.x, ...points.map((e) => c0.x + (c1.x - c0.x) * e)], extrapolate: 'clamp' });
  const y = lagged.interpolate({
    inputRange: input,
    outputRange: [c0.y, c0.y, ...points.map((e) => c0.y + (c1.y - c0.y) * e - arc * Math.sin(Math.PI * e))],
    extrapolate: 'clamp',
  });
  const visible = source.interpolate({ inputRange: [1, 1.12, 1.8, 1.97], outputRange: [0, opacity, opacity, 0], extrapolate: 'clamp' });
  return (
    <Animated.View
      style={[
        styles.trail,
        { width: size, height: size, borderRadius: size / 2, opacity: visible, left: Animated.subtract(x, size / 2), top: Animated.subtract(y, size / 2) },
      ]}
    />
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tile: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 24,
  },
  rim: { borderWidth: 1.5, borderColor: colors.accentGlow },
  glyph: { alignItems: 'center', justifyContent: 'center' },
  glyphDisc: { alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.primary, 0.92) },
  trail: { position: 'absolute', backgroundColor: colors.accent },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.accentGlow },
}));
