// Cầu nối thiết bị vật lý -> PC trong lúc stream.
//
//  - Tay cầm (Bluetooth/USB): module native bắt phím + trục của Android, ở đây đổi
//    theo cài đặt (vùng chết, bố cục) rồi gửi trên các kênh `controllers` /
//    `controllerN` của Moonlight-web, đúng định dạng client web gửi. Rung từ PC
//    được chuyển ngược về tay cầm.
//  - Bàn phím vật lý: keycode Android -> Windows virtual-key; phím Host (mặc
//    định Ctrl phải) giữ + phím = phím tắt của app, không gửi sang PC.
//  - Chuột vật lý: chuyển động tương đối (pointer capture), nút, cuộn.
//  - Nút Home/Guide của tay cầm mở menu của app (chụp màn hình, sao chép, tab game).

import { useEffect, useRef } from 'react';
import {
  addListener, rumble as nativeRumble, setPointerCapture, stopRumble,
  type NativeGamepadState,
} from 'jetsona-input';

import { useInputDevices, type LocalDevice } from '@/features/devices/useInputDevices';
import { useCaptureMode } from '@/features/gamepad/captureMode';
import { webCodeForKeyCode, vkForWebCode } from '@/features/settings/keycodes';
import { applyDeadzone, type HostShortcutAction, type InputSettings } from '@/lib/input-settings';
import type { NativeMoonlightClient } from '@/lib/moonlight-native';

const MAX_SLOTS = 16;
// Mọi cờ nút Moonlight mà tay cầm Android có thể báo (không gồm paddle/touchpad).
const SUPPORTED_BUTTONS = 0x1000 | 0x2000 | 0x4000 | 0x8000 | 0x0001 | 0x0002 | 0x0004 | 0x0008
  | 0x0100 | 0x0200 | 0x0010 | 0x0020 | 0x0040 | 0x0080 | 0x0400;
const CAPABILITY_RUMBLE = 1;
const A = 0x1000; const B = 0x2000; const X = 0x4000; const Y = 0x8000;

type Options = {
  client: NativeMoonlightClient | null;
  inputReady: boolean;
  live: boolean;
  settingsRef: { current: InputSettings };
  /** Menu Guide đang mở: tay cầm chỉ điều khiển menu, PC nhận trạng thái trung tính. */
  guideOpen: boolean;
  onGuide: () => void;
  onShortcut: (action: HostShortcutAction) => void;
};

function swapFaceButtons(buttons: number): number {
  let next = buttons & ~(A | B | X | Y);
  if (buttons & A) next |= B;
  if (buttons & B) next |= A;
  if (buttons & X) next |= Y;
  if (buttons & Y) next |= X;
  return next;
}

function adjust(state: NativeGamepadState, settings: InputSettings) {
  return {
    buttons: settings.controllerLayout === 'nintendo' ? swapFaceButtons(state.buttons) : state.buttons,
    lt: applyDeadzone(state.lt, settings.triggerDeadzone),
    rt: applyDeadzone(state.rt, settings.triggerDeadzone),
    lx: applyDeadzone(state.lx, settings.leftDeadzone),
    ly: applyDeadzone(state.ly, settings.leftDeadzone),
    rx: applyDeadzone(state.rx, settings.rightDeadzone),
    ry: applyDeadzone(state.ry, settings.rightDeadzone),
  };
}

const NEUTRAL = { buttons: 0, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 };

export function useInputBridge({ client, inputReady, live, settingsRef, guideOpen, onGuide, onShortcut }: Options): {
  nativeIdForSlot: (slot: number) => number | undefined;
} {
  const { devices } = useInputDevices();
  const clientRef = useRef(client);
  clientRef.current = client;
  const guideOpenRef = useRef(guideOpen);
  guideOpenRef.current = guideOpen;
  const onGuideRef = useRef(onGuide);
  onGuideRef.current = onGuide;
  const onShortcutRef = useRef(onShortcut);
  onShortcutRef.current = onShortcut;

  const slots = useRef(new Map<number, number>());
  const latest = useRef(new Map<number, NativeGamepadState>());

  // Tay cầm/bàn phím/chuột vật lý thuộc về PC suốt phiên.
  useCaptureMode('stream', live);

  const sendPad = (nativeId: number, state: NativeGamepadState | null) => {
    const target = clientRef.current;
    const slot = slots.current.get(nativeId);
    if (!target || slot === undefined) return;
    const settings = settingsRef.current;
    target.sendControllerState(
      slot,
      !state || guideOpenRef.current ? NEUTRAL : adjust(state, settings),
    );
  };

  // Khai báo / gỡ tay cầm theo sự kiện cắm rút.
  useEffect(() => {
    if (!client || !inputReady || !live) return;
    const pads = devices.filter((device): device is LocalDevice => device.kind === 'controller');
    const present = new Set(pads.map((pad) => pad.nativeId));
    for (const [nativeId, slot] of Array.from(slots.current)) {
      if (!present.has(nativeId)) {
        client.sendControllerRemove(slot);
        slots.current.delete(nativeId);
        latest.current.delete(nativeId);
      }
    }
    for (const pad of pads) {
      if (slots.current.has(pad.nativeId)) continue;
      const used = new Set(slots.current.values());
      let slot = 0;
      while (used.has(slot) && slot < MAX_SLOTS) slot += 1;
      if (slot >= MAX_SLOTS) break;
      slots.current.set(pad.nativeId, slot);
      client.sendControllerAdd(slot, SUPPORTED_BUTTONS, pad.rumble ? CAPABILITY_RUMBLE : 0);
      const last = latest.current.get(pad.nativeId);
      if (last) sendPad(pad.nativeId, last);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, devices, inputReady, live]);

  // Phiên đóng hoặc kết nối lại: quên slot để lần sau khai báo lại từ đầu.
  useEffect(() => {
    if (client && live) return;
    slots.current.clear();
  }, [client, live]);

  // Trạng thái tay cầm -> PC.
  useEffect(() => {
    if (!live) return;
    const off = addListener('onGamepadState', (state) => {
      latest.current.set(state.deviceId, state);
      sendPad(state.deviceId, state);
    });
    const offButton = addListener('onGamepadButton', (event) => {
      if (event.button === 'guide' && event.down) onGuideRef.current();
    });
    return () => { off(); offButton(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // Mở menu Guide: PC thấy tay cầm về trung tính ngay, khỏi kẹt nút/cần.
  useEffect(() => {
    if (!guideOpen) return;
    for (const nativeId of slots.current.keys()) sendPad(nativeId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideOpen]);

  // Dừng rung khi rời phiên.
  useEffect(() => () => {
    for (const nativeId of slots.current.keys()) stopRumble(nativeId);
  }, []);

  // Bàn phím và chuột vật lý.
  useEffect(() => {
    if (!live) return;
    const held = new Set<string>();
    let hostDown = false;
    const consumed = new Set<string>();

    const offKey = addListener('onKey', (event) => {
      const target = clientRef.current;
      if (!target) return;
      const settings = settingsRef.current;
      const code = webCodeForKeyCode(event.keyCode);

      // Phím Host: giữ để dùng phím tắt, không gửi sang PC.
      if (code && code === settings.hostKey) {
        hostDown = event.down;
        if (!event.down) consumed.clear();
        return;
      }
      if (hostDown && code && event.down) {
        const action = settings.hostShortcuts[code];
        if (action) {
          consumed.add(code);
          onShortcutRef.current(action);
          return;
        }
      }
      if (code && consumed.has(code)) {
        if (!event.down) consumed.delete(code);
        return;
      }

      // Đổi phím theo cài đặt rồi gửi.
      const remapped = code ? settings.keyboardRemaps[code] : undefined;
      const vk = remapped ? vkForWebCode(remapped) ?? event.vk : event.vk;
      if (event.down) held.add(String(vk)); else held.delete(String(vk));
      target.sendKey(event.down, vk, event.modifiers);
    });

    const offMouse = addListener('onMouse', (event) => {
      const target = clientRef.current;
      if (!target) return;
      const settings = settingsRef.current;
      if (event.type === 'move') {
        target.sendMouseMove(event.dx * settings.mouseSensitivity, event.dy * settings.mouseSensitivity);
      } else if (event.type === 'button') {
        target.sendMouseButton(event.down, event.button);
      } else {
        const direction = settings.invertScroll ? -1 : 1;
        const unit = 120 * settings.scrollSensitivity * direction;
        target.sendScroll(event.dx * unit, event.dy * unit);
      }
    });

    return () => {
      offKey();
      offMouse();
      // Nhả mọi phím còn đang giữ để PC không kẹt.
      const target = clientRef.current;
      held.forEach((vk) => target?.sendKey(false, Number(vk)));
      held.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // Chuột vật lý: pointer capture để có chuyển động tương đối, không kẹt mép màn.
  const hasMouse = devices.some((device) => device.kind === 'mouse');
  useEffect(() => {
    if (!live || !hasMouse) return;
    setPointerCapture(true);
    return () => setPointerCapture(false);
  }, [live, hasMouse]);

  return {
    nativeIdForSlot: (slot: number) => {
      for (const [nativeId, assigned] of slots.current) if (assigned === slot) return nativeId;
      return undefined;
    },
  };
}

/**
 * Chuyển lệnh rung của PC sang tay cầm thật. Tách khỏi hook để phiên (nơi tạo
 * client) gắn vào callback `onRumble` mà không phụ thuộc vòng đời của hook này.
 */
export function createRumbleHandler(
  deviceForSlot: (slot: number) => number | undefined,
  settingsRef: { current: InputSettings },
) {
  return (event: { slot: number; low: number; high: number }) => {
    const nativeId = deviceForSlot(event.slot);
    if (nativeId === undefined) return;
    const settings = settingsRef.current;
    if (!settings.vibrationEnabled) { stopRumble(nativeId); return; }
    const strength = settings.vibrationStrength / 100;
    if (event.low <= 0.01 && event.high <= 0.01) { stopRumble(nativeId); return; }
    nativeRumble(nativeId, event.low * strength, event.high * strength, 500);
  };
}
