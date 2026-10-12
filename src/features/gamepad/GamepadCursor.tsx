// Con trỏ điều khiển giao diện bằng tay cầm, tương đương GamepadCursor.tsx bên
// web: cần trái/D-pad di chuyển, A bấm, cần phải cuộn, B quay lại, LB/RB đổi tab.
//
// Native không có DOM để tìm phần tử dưới con trỏ, nên A bắn một cú chạm thật
// (qua module native) vào đúng toạ độ đó; cuộn là kéo ngón giả. Nhờ vậy mọi
// Pressable/ScrollView hiện có dùng được mà không phải đăng ký từng cái.

import { useEffect, useRef, useState } from 'react';
import { Animated, PixelRatio, StyleSheet, View } from 'react-native';
import { addListener, injectTouch, type NativeGamepadButton } from 'jetsona-input';

import { colors } from '@/theme';
import { useUi } from '@/ui/scale';
import { clampCursor, cursorVector, scrollVector } from './navigation';
import { dispatchBack, dispatchGuide, dispatchTab, isCursorSuspended } from './registry';

const CURSOR_SPEED = 760; // dp/s ở khung thiết kế
const SCROLL_SPEED = 720;
const MAX_FRAME_SECONDS = 1 / 20;
const IDLE_FADE_MS = 3500;
const HIDE_AFTER_MS = 12_000;

type PadInput = { buttons: number; lx: number; ly: number; rx: number; ry: number };

/** Chỉ gắn khi KHÔNG đang stream: lúc stream tay cầm thuộc về máy ở nhà. */
export default function GamepadCursor({ enabled }: { enabled: boolean }) {
  const { width, height, scale } = useUi();
  const x = useRef(new Animated.Value(width / 2)).current;
  const y = useRef(new Animated.Value(height / 2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const point = useRef({ x: width / 2, y: height / 2 });
  const input = useRef<PadInput | null>(null);
  const pressed = useRef(false);
  const drag = useRef({ active: false, dx: 0, dy: 0 });
  const frame = useRef<number | null>(null);
  const lastFrame = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const viewport = useRef({ width, height });
  viewport.current = { width, height };

  useEffect(() => {
    if (!enabled) return;
    const ratio = PixelRatio.get();
    const px = (value: number) => Math.round(value * ratio);

    const wake = () => {
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0.35, duration: 400, useNativeDriver: true }).start();
        // Lâu không có tín hiệu nào (tay cầm đã tắt/rút) thì ẩn hẳn con trỏ.
        idleTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
      }, IDLE_FADE_MS);
    };

    const endDrag = () => {
      const state = drag.current;
      if (!state.active) return;
      injectTouch('up', px(point.current.x + state.dx), px(point.current.y + state.dy));
      state.active = false;
      state.dx = 0;
      state.dy = 0;
    };

    const step = (time: number) => {
      frame.current = null;
      const state = input.current;
      if (!state) return;
      if (isCursorSuspended()) { endDrag(); return; }
      const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (time - lastFrame.current) / 1000));
      lastFrame.current = time;

      const move = cursorVector(state);
      const scroll = scrollVector(state);
      let active = false;

      if (move.x !== 0 || move.y !== 0) {
        active = true;
        point.current = clampCursor({
          x: point.current.x + move.x * CURSOR_SPEED * scale * dt,
          y: point.current.y + move.y * CURSOR_SPEED * scale * dt,
        }, viewport.current);
        x.setValue(point.current.x);
        y.setValue(point.current.y);
        wake();
        // Giữ A trong lúc di chuyển = kéo thả.
        if (pressed.current) injectTouch('move', px(point.current.x), px(point.current.y));
      }

      if (scroll.x !== 0 || scroll.y !== 0) {
        active = true;
        const current = drag.current;
        if (!current.active) {
          injectTouch('down', px(point.current.x), px(point.current.y));
          current.active = true;
          current.dx = 0;
          current.dy = 0;
        }
        // Đẩy cần xuống = nội dung đi lên = ngón kéo lên.
        current.dx -= scroll.x * SCROLL_SPEED * scale * dt;
        current.dy -= scroll.y * SCROLL_SPEED * scale * dt;
        injectTouch('move', px(point.current.x + current.dx), px(point.current.y + current.dy));
        wake();
      } else {
        endDrag();
      }

      if (active) frame.current = requestAnimationFrame(step);
    };

    const kick = () => {
      if (frame.current == null) {
        lastFrame.current = performance.now();
        frame.current = requestAnimationFrame(step);
      }
    };

    const offState = addListener('onGamepadState', (next) => {
      input.current = next;
      kick();
    });

    const offButton = addListener('onGamepadButton', (event: NativeGamepadButton) => {
      if (event.button === 'a' && isCursorSuspended()) return;
      wake();
      if (event.button === 'a') {
        if (event.down && !pressed.current) {
          pressed.current = true;
          injectTouch('down', px(point.current.x), px(point.current.y));
          Animated.timing(press, { toValue: 1, duration: 70, useNativeDriver: true }).start();
        } else if (!event.down && pressed.current) {
          pressed.current = false;
          injectTouch('up', px(point.current.x), px(point.current.y));
          Animated.timing(press, { toValue: 0, duration: 140, useNativeDriver: true }).start();
        }
        return;
      }
      if (!event.down) return;
      if (event.button === 'b') dispatchBack();
      else if (event.button === 'lb') dispatchTab(-1);
      else if (event.button === 'rb') dispatchTab(1);
      else if (event.button === 'guide') dispatchGuide();
    });

    return () => {
      offState();
      offButton();
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
      clearTimeout(idleTimer.current);
      if (pressed.current) injectTouch('up', px(point.current.x), px(point.current.y));
      pressed.current = false;
      endDrag();
    };
  }, [enabled, opacity, press, scale, x, y]);

  if (!enabled || !visible) return null;

  const size = 22 * scale;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.cursor,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity,
            transform: [
              { translateX: x },
              { translateY: y },
              { translateX: -size / 2 },
              { translateY: -size / 2 },
              { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) },
            ],
          },
        ]}
      >
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cursor: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(102,168,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 12,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.white },
});
