import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useSceneActive } from '@/features/gamepad/focus';
import { useMotion } from '@/ui/motion';

import { CONSOLE } from './consoleVisuals';

/** Finite, interruptible centering without updating React state on each frame. */
export function useConsoleRailScroll(scrollTo: (offset: number) => void) {
  const { active, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => {
    if (!active || !sceneActive) stop();
    return stop;
  }, [active, sceneActive, stop]);
  const center = useCallback((target: number, animated: boolean) => {
    stop();
    if (!animated || reduceMotion || !active || !sceneActive || Math.abs(target - offset.current) < 0.5) {
      offset.current = target;
      scrollTo(target);
      return;
    }
    const from = offset.current;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started) / CONSOLE.scrollMs));
      offset.current = from + (target - from) * (1 - (1 - progress) ** 3);
      scrollTo(offset.current);
      frame.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  }, [active, reduceMotion, sceneActive, scrollTo, stop]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.x;
  }, []);
  return { center, stop, onScroll };
}
