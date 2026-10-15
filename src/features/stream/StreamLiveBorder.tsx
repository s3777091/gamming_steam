// Viền xanh báo "màn hình này đang được người khác xem" — bản native của
// src/components/StreamLiveBorder.tsx bên web.
//
// Hiệu ứng mở/đóng cố ý đi ra và thu về ĐÚNG nút Streaming vừa bấm: đó là câu
// duy nhất nói được "cái vừa bấm gây ra cái này" mà không cần chữ. Web dùng
// clip-path hình tròn; ở đây viền được vẽ dọc theo mép màn hình từ điểm gần nút
// nhất, chạy hai chiều và gặp nhau ở phía đối diện. Người không muốn nhìn nó tắt
// hẳn trong cài đặt (`stream-overlay-settings`).

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

export type BorderOrigin = { x: number; y: number };

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPARK_COUNT = 12;
const REVEAL_MS = 620;
const RETRACT_MS = 380;
const BURST_SIZE = 160;
const GREEN = '#2fe08a';

/** Góc bắn của các tia, rải đều rồi lệch nhẹ để không thành hình ngôi sao. */
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, index) => {
  const spread = (index / SPARK_COUNT) * Math.PI * 2;
  const wobble = ((index * 37) % 11) / 11 - 0.5;
  return {
    angle: spread + wobble * 0.28,
    distance: 90 + ((index * 53) % 7) * 26,
    delay: ((index * 29) % 5) * 28,
  };
});

/** Các lớp nét: một đường sắc và hai lớp quầng mờ dần vào trong. */
const STROKES = [
  { width: 28, opacity: 0.05 },
  { width: 10, opacity: 0.14 },
  { width: 2, opacity: 0.85 },
];

/**
 * Hai đường đi quanh mép màn hình, cùng xuất phát ở điểm trên mép gần `origin`
 * nhất: một theo chiều kim đồng hồ, một ngược lại. Mỗi đường chỉ hiện nửa chu vi
 * nên khi mở hết chúng gặp nhau đúng ở phía đối diện.
 */
function edgePaths(origin: BorderOrigin, width: number, height: number) {
  const inset = 1;
  const left = inset;
  const top = inset;
  const right = Math.max(left, width - inset);
  const bottom = Math.max(top, height - inset);
  const x = Math.min(Math.max(origin.x, left), right);
  const y = Math.min(Math.max(origin.y, top), bottom);

  // Cạnh gần nhất: 0 = trên, 1 = phải, 2 = dưới, 3 = trái.
  const distances = [y - top, right - x, bottom - y, x - left];
  const edge = distances.indexOf(Math.min(...distances));
  const start = edge === 0 ? [x, top] : edge === 1 ? [right, y] : edge === 2 ? [x, bottom] : [left, y];

  // Cạnh `e` đi từ corners[e] tới corners[e + 1] theo chiều kim đồng hồ.
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]];
  const clockwise = [0, 1, 2, 3].map((k) => corners[(edge + 1 + k) % 4]);
  const counter = [0, 1, 2, 3].map((k) => corners[(edge - k + 4) % 4]);
  const toPath = (points: number[][]) =>
    `M${start[0]} ${start[1]} ${points.map(([px, py]) => `L${px} ${py}`).join(' ')} L${start[0]} ${start[1]}`;

  return {
    perimeter: 2 * ((right - left) + (bottom - top)),
    paths: [toPath(clockwise), toPath(counter)],
  };
}

export function StreamLiveBorder({
  open,
  origin,
  onRetracted,
}: {
  open: boolean;
  /** Toạ độ trong cửa sổ của nút vừa bấm; null thì toả ra từ giữa mép dưới. */
  origin: BorderOrigin | null;
  onRetracted: () => void;
}) {
  const [surface, setSurface] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0.82));
  const [burst] = useState(() => new Animated.Value(0));
  const [sparks] = useState(() => SPARKS.map(() => new Animated.Value(0)));

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduceMotion(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  const centre = useMemo<BorderOrigin>(() => ({
    x: origin?.x ?? surface.width / 2,
    y: origin?.y ?? surface.height,
  }), [origin, surface.height, surface.width]);

  const geometry = useMemo(
    () => (surface.width > 0 && surface.height > 0 ? edgePaths(centre, surface.width, surface.height) : null),
    [centre, surface.height, surface.width],
  );

  const onRetractedRef = useRef(onRetracted);
  useEffect(() => { onRetractedRef.current = onRetracted; });
  const ready = geometry !== null;

  // Mở: viền chạy ra từ nút. Đóng: thu về nút rồi mới báo cho cha gỡ component —
  // gỡ trước thì hiệu ứng biến mất như một cú nháy.
  useEffect(() => {
    if (!ready) return;
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      if (!open) onRetractedRef.current();
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? REVEAL_MS : RETRACT_MS,
      easing: open ? Easing.bezier(0.16, 1, 0.3, 1) : Easing.bezier(0.7, 0, 0.84, 0),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) onRetractedRef.current();
    });
    return () => animation.stop();
  }, [open, progress, ready, reduceMotion]);

  // Nhịp thở nhẹ của viền khi đang phát.
  useEffect(() => {
    if (reduceMotion || !open) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.82, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [open, pulse, reduceMotion]);

  // Quầng sáng + tia bắn ra từ nút, mỗi lần mở một lần.
  useEffect(() => {
    if (!open || reduceMotion) return;
    burst.setValue(0);
    sparks.forEach((spark) => spark.setValue(0));
    const animation = Animated.parallel([
      Animated.timing(burst, { toValue: 1, duration: 720, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
      ...sparks.map((spark, index) => Animated.timing(spark, {
        toValue: 1,
        duration: 620,
        delay: SPARKS[index].delay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      })),
    ]);
    animation.start();
    return () => animation.stop();
  }, [burst, open, reduceMotion, sparks]);

  const half = geometry ? geometry.perimeter / 2 : 0;
  const dashOffset = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [half * 2, half] }),
    [half, progress],
  );

  return (
    <View
      pointerEvents="none"
      style={styles.root}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSurface((current) => (current.width === width && current.height === height ? current : { width, height }));
      }}
    >
      {geometry ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulse }]}>
          <Svg width={surface.width} height={surface.height}>
            {STROKES.map((stroke) => geometry.paths.map((d, index) => (
              <AnimatedPath
                key={`${stroke.width}-${index}`}
                d={d}
                fill="none"
                stroke={GREEN}
                strokeOpacity={stroke.opacity}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[half * 2, half * 2]}
                strokeDashoffset={dashOffset}
              />
            )))}
          </Svg>
        </Animated.View>
      ) : null}

      {open && !reduceMotion ? (
        <View style={[styles.burstAnchor, { left: centre.x, top: centre.y }]}>
          <Animated.View
            style={[
              styles.burst,
              {
                opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
                transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.15, 3.4] }) }],
              },
            ]}
          >
            <Svg width={BURST_SIZE} height={BURST_SIZE}>
              <Defs>
                <RadialGradient id="liveBurst" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#78ffbe" stopOpacity={0.85} />
                  <Stop offset="0.6" stopColor={GREEN} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={GREEN} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={BURST_SIZE / 2} cy={BURST_SIZE / 2} r={BURST_SIZE / 2} fill="url(#liveBurst)" />
            </Svg>
          </Animated.View>

          {SPARKS.map((spark, index) => {
            const value = sparks[index];
            return (
              <Animated.View
                key={index}
                style={[
                  styles.spark,
                  {
                    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                    transform: [
                      { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(spark.angle) * spark.distance] }) },
                      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(spark.angle) * spark.distance] }) },
                      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Nằm trên cả menu Guide (zIndex/elevation 160) để thấy viền bắn ra từ nút.
  root: { ...StyleSheet.absoluteFill, zIndex: 170, elevation: 170 },
  burstAnchor: { position: 'absolute', width: 0, height: 0 },
  burst: {
    position: 'absolute',
    left: -BURST_SIZE / 2,
    top: -BURST_SIZE / 2,
    width: BURST_SIZE,
    height: BURST_SIZE,
  },
  spark: {
    position: 'absolute',
    left: -3,
    top: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8dffc4',
  },
});
