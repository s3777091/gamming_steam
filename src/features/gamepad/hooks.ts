import { useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

import { dispatchBack, onGuide, onTabSwitch, pushBack, suspendCursor } from './registry';

/**
 * Nút B của tay cầm và nút Back của Android cùng đi vào đây. Handler trả
 * `true` nghĩa là "không phải việc của tôi" và nhường cho tầng bên dưới.
 */
export function useBack(handler: () => boolean | void, enabled = true): void {
  const ref = useRef(handler);
  useLayoutEffect(() => { ref.current = handler; }, [handler]);
  useEffect(() => {
    if (!enabled) return;
    return pushBack(() => ref.current());
  }, [enabled]);
}

/** Cầu nối nút Back của hệ thống vào cùng ngăn xếp, đặt một lần ở gốc app. */
export function useHardwareBack(): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => dispatchBack());
    return () => subscription.remove();
  }, []);
}

export function useGamepadTabs(handler: (direction: -1 | 1) => boolean | void, enabled = true): void {
  const ref = useRef(handler);
  useLayoutEffect(() => { ref.current = handler; }, [handler]);
  useEffect(() => {
    if (!enabled) return;
    return onTabSwitch((direction) => ref.current(direction));
  }, [enabled]);
}

export function useGuide(handler: () => void, enabled = true): void {
  const ref = useRef(handler);
  useLayoutEffect(() => { ref.current = handler; }, [handler]);
  useEffect(() => {
    if (!enabled) return;
    return onGuide(() => ref.current());
  }, [enabled]);
}

/** Tạm dừng điều hướng UI bằng tay cầm trong lúc màn này đọc tín hiệu tay cầm thô. */
export function useSuspendCursor(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    return suspendCursor();
  }, [enabled]);
}
