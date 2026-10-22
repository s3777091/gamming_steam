// Điều khiển giao diện bằng tay cầm kiểu console (PS5): D-pad / cần trái nhảy
// từng nấc giữa các nút, A bấm, B quay lại, LB/RB đổi tab, cần phải cuộn. Không
// có con trỏ tự do và không bắn cú chạm giả — phần việc nằm ở `focus.tsx`.

import { useEffect } from 'react';
import { addListener, type NativeGamepadButton } from 'jetsona-input';

import { useUi } from '@/ui/scale';
import { activateFocus, ensureFocusActive, moveFocus, scrollFocused, setFocusViewport, type Direction } from './focus';
import { listenGuideButton } from './guideButton';
import { navDirection, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS, scrollVector } from './navigation';
import { dispatchBack, dispatchGuide, dispatchTab, isCursorSuspended, setNavigatorEnabled } from './registry';

const SCROLL_SPEED = 900; // px/s ở tốc độ tối đa của cần phải
const MAX_FRAME_SECONDS = 1 / 20;

/** Chỉ gắn khi KHÔNG đang stream: lúc stream tay cầm thuộc về máy ở nhà. */
export default function GamepadNavigator({ enabled }: { enabled: boolean }) {
  const { width, height } = useUi();

  useEffect(() => { setFocusViewport(width, height); }, [width, height]);

  useEffect(() => {
    if (!enabled) return;
    setNavigatorEnabled(true);

    const directions = new Map<number, Direction | null>();
    let held: Direction | null = null;
    let repeat: ReturnType<typeof setTimeout> | undefined;
    let frame: number | null = null;
    let lastFrame = 0;
    let scroll = { x: 0, y: 0 };

    const hold = (next: Direction | null) => {
      if (next === held) return;
      held = next;
      clearTimeout(repeat);
      if (!next) return;
      moveFocus(next);
      const tick = () => {
        if (held !== next) return;
        if (!isCursorSuspended()) moveFocus(next);
        repeat = setTimeout(tick, REPEAT_INTERVAL_MS);
      };
      repeat = setTimeout(tick, REPEAT_DELAY_MS);
    };

    const stepScroll = (time: number) => {
      frame = null;
      if ((!scroll.x && !scroll.y) || isCursorSuspended()) return;
      const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (time - lastFrame) / 1000));
      lastFrame = time;
      scrollFocused(scroll.x * SCROLL_SPEED * dt, scroll.y * SCROLL_SPEED * dt);
      frame = requestAnimationFrame(stepScroll);
    };

    const offState = addListener('onGamepadState', (state) => {
      directions.set(state.deviceId, navDirection(state, directions.get(state.deviceId) ?? null));
      let next: Direction | null = null;
      for (const direction of directions.values()) {
        if (direction) { next = direction; break; }
      }
      hold(isCursorSuspended() ? null : next);

      scroll = scrollVector(state);
      if ((scroll.x || scroll.y) && frame === null && !isCursorSuspended()) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(stepScroll);
      }
    });

    // Rút tay cầm đang giữ hướng: dừng lặp, khỏi trôi tiêu điểm mãi.
    const offDevices = addListener('onDevicesChanged', () => {
      directions.clear();
      scroll = { x: 0, y: 0 };
      hold(null);
    });

    const offButton = addListener('onGamepadButton', (event: NativeGamepadButton) => {
      if (!event.down) return;
      if (event.button === 'b') dispatchBack();
      else if (isCursorSuspended()) return;
      else if (event.button === 'a') activateFocus();
      else if (event.button === 'lb') {
        ensureFocusActive();
        dispatchTab(-1);
      }
      else if (event.button === 'rb') {
        ensureFocusActive();
        dispatchTab(1);
      }
    });

    const offGuideKey = addListener('onGuideKey', (event) => {
      if (event.down) dispatchGuide();
    });
    const offCombo = listenGuideButton(dispatchGuide);

    return () => {
      setNavigatorEnabled(false);
      offState();
      offDevices();
      offButton();
      offGuideKey();
      offCombo();
      clearTimeout(repeat);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return null;
}
