// Chuyển động dùng chung cho lớp trang trí. Mỗi nhóm hạt chỉ chạy một vòng lặp native;
// từng hạt lấy pha và tốc độ riêng bằng phép cộng / nhân / chia dư của Animated.

import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Số giả ngẫu nhiên ổn định theo chỉ số: cùng (i, salt) luôn ra cùng giá trị trong [0, 1). */
export function rand(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 0 → 1 lặp mãi, tuyến tính. Dừng (giữ nguyên vị trí) khi running = false. */
export function useLoop(duration: number, running: boolean): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!running) return;
    const anim = Animated.loop(
      Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [duration, running, value]);
  return value;
}

/** 0 → 1 → 0 lặp mãi, chậm dần ở hai đầu: đung đưa, vỗ cánh, nhấp nháy. */
export function useSwing(duration: number, running: boolean): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!running) return;
    const half = duration / 2;
    const easing = Easing.inOut(Easing.sin);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: half, easing, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: half, easing, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [duration, running, value]);
  return value;
}

/**
 * Tiến trình riêng của một hạt từ vòng lặp chung: nhanh gấp `speed` lần (số nguyên để
 * không giật khi vòng lặp quay về 0) và lệch `phase` để các hạt không xuất phát cùng lúc.
 */
export function particleProgress(loop: Animated.Value, speed: number, phase: number) {
  return Animated.modulo(Animated.add(Animated.multiply(loop, speed), phase), 1);
}
