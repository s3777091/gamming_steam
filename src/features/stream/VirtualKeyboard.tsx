// Bàn phím ảo nổi dạng kính mờ (compact landscape), dùng trong lúc stream PC
// và trên màn chính. Không chặn vùng chạm xung quanh (pointerEvents="box-none")
// để người dùng vừa chấm chuột vào ô nhập trên PC vừa bấm phím ngay.
//
// Kích thước luôn thu gọn theo khung màn hình ngang và tự tránh vùng con trỏ
// chuột hoặc cho phép kéo / lật Trên-Dưới / thu gọn thành viên thuốc nhỏ.

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp, Keyboard as KeyboardIcon, Minus, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';

import { playUiSound } from '@/features/sound/UiSoundProvider';
import type { NativeMoonlightClient } from '@/lib/moonlight-native';
import { alpha, glassShadow, makeStyles, useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

// ------------------------------------------------------------------ trạng thái dùng chung

let currentOpen = false;
let currentMinimized = false;
let currentDock: 'bottom' | 'top' = 'bottom';
let currentDragOffset = { x: 0, y: 0 };
let dragBaseOffset = { x: 0, y: 0 };
let isManualDragged = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function isVirtualKeyboardOpen(): boolean {
  return currentOpen;
}

export function setVirtualKeyboardOpen(open: boolean): void {
  if (currentOpen === open && (!open || !currentMinimized)) return;
  currentOpen = open;
  if (open) currentMinimized = false;
  notify();
}

export function toggleVirtualKeyboard(): void {
  if (!currentOpen) {
    currentOpen = true;
    currentMinimized = false;
  } else if (currentMinimized) {
    currentMinimized = false;
  } else {
    currentOpen = false;
  }
  notify();
}

export function setVirtualKeyboardMinimized(minimized: boolean): void {
  if (currentMinimized === minimized) return;
  currentMinimized = minimized;
  notify();
}

/**
 * Gọi khi người dùng chạm chuột trên màn hình stream:
 * - Nếu bàn phím ảo đang bật ở dạng thu gọn (minimized) thì bung lại để gõ ngay.
 * - Nếu điểm chạm nằm đúng nửa màn hình đang đặt bàn phím (và chưa kéo tay cố định)
 *   thì tự lật bàn phím lên trên hoặc xuống dưới để không che con trỏ chuột.
 */
export function notifyVirtualKeyboardCursorTap(y: number, stageHeight: number): void {
  if (!currentOpen || stageHeight <= 0) return;
  let changed = false;
  if (currentMinimized) {
    currentMinimized = false;
    changed = true;
  }
  if (!isManualDragged) {
    const ratio = y / stageHeight;
    if (currentDock === 'bottom' && ratio > 0.56) {
      currentDock = 'top';
      currentDragOffset = { x: 0, y: 0 };
      changed = true;
    } else if (currentDock === 'top' && ratio < 0.44) {
      currentDock = 'bottom';
      currentDragOffset = { x: 0, y: 0 };
      changed = true;
    }
  }
  if (changed) notify();
}

function flipVirtualKeyboardDock(): void {
  isManualDragged = false;
  currentDragOffset = { x: 0, y: 0 };
  currentDock = currentDock === 'bottom' ? 'top' : 'bottom';
  notify();
}

const headerPanHandlers = PanResponder.create({
  onStartShouldSetPanResponder: () => true,
  onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
  onPanResponderGrant: () => {
    dragBaseOffset = currentDragOffset;
  },
  onPanResponderMove: (_, g) => {
    isManualDragged = true;
    currentDragOffset = {
      x: dragBaseOffset.x + g.dx,
      y: dragBaseOffset.y + g.dy,
    };
    notify();
  },
}).panHandlers;

export function useVirtualKeyboardState(): {
  open: boolean;
  minimized: boolean;
  dock: 'bottom' | 'top';
  dragOffset: { x: number; y: number };
  setOpen: (open: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  toggle: () => void;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return {
    open: currentOpen,
    minimized: currentMinimized,
    dock: currentDock,
    dragOffset: currentDragOffset,
    setOpen: setVirtualKeyboardOpen,
    setMinimized: setVirtualKeyboardMinimized,
    toggle: toggleVirtualKeyboard,
  };
}

// ------------------------------------------------------------------ bảng mã phím Windows VK

const MOD_SHIFT = 1;
const MOD_CTRL = 2;
const MOD_ALT = 4;
const MOD_META = 8;

const VK_SHIFT = 0xA0;
const VK_CTRL = 0xA2;
const VK_ALT = 0xA4;
const VK_META = 0x5B;

type KeySpec = {
  id: string;
  label: string;
  shiftLabel?: string;
  vk: number;
  /** Ký tự văn bản tương ứng (khi dùng ở màn chính không qua Moonlight). */
  char?: string;
  shiftChar?: string;
  flex?: number;
  modifier?: 'shift' | 'ctrl' | 'alt' | 'meta' | 'caps' | 'fn';
  accent?: boolean;
  repeatable?: boolean;
};

const ROW_1_NORMAL: KeySpec[] = [
  { id: 'esc', label: 'Esc', vk: 0x1B, flex: 1.15 },
  { id: 'grave', label: '`', shiftLabel: '~', vk: 0xC0, char: '`', shiftChar: '~' },
  { id: '1', label: '1', shiftLabel: '!', vk: 0x31, char: '1', shiftChar: '!' },
  { id: '2', label: '2', shiftLabel: '@', vk: 0x32, char: '2', shiftChar: '@' },
  { id: '3', label: '3', shiftLabel: '#', vk: 0x33, char: '3', shiftChar: '#' },
  { id: '4', label: '4', shiftLabel: '$', vk: 0x34, char: '4', shiftChar: '$' },
  { id: '5', label: '5', shiftLabel: '%', vk: 0x35, char: '5', shiftChar: '%' },
  { id: '6', label: '6', shiftLabel: '^', vk: 0x36, char: '6', shiftChar: '^' },
  { id: '7', label: '7', shiftLabel: '&', vk: 0x37, char: '7', shiftChar: '&' },
  { id: '8', label: '8', shiftLabel: '*', vk: 0x38, char: '8', shiftChar: '*' },
  { id: '9', label: '9', shiftLabel: '(', vk: 0x39, char: '9', shiftChar: '(' },
  { id: '0', label: '0', shiftLabel: ')', vk: 0x30, char: '0', shiftChar: ')' },
  { id: 'minus', label: '-', shiftLabel: '_', vk: 0xBD, char: '-', shiftChar: '_' },
  { id: 'equal', label: '=', shiftLabel: '+', vk: 0xBB, char: '=', shiftChar: '+' },
  { id: 'bs', label: '⌫', vk: 0x08, flex: 1.35, repeatable: true },
];

const ROW_1_FN: KeySpec[] = [
  { id: 'esc', label: 'Esc', vk: 0x1B, flex: 1.15 },
  { id: 'f1', label: 'F1', vk: 0x70 },
  { id: 'f2', label: 'F2', vk: 0x71 },
  { id: 'f3', label: 'F3', vk: 0x72 },
  { id: 'f4', label: 'F4', vk: 0x73 },
  { id: 'f5', label: 'F5', vk: 0x74 },
  { id: 'f6', label: 'F6', vk: 0x75 },
  { id: 'f7', label: 'F7', vk: 0x76 },
  { id: 'f8', label: 'F8', vk: 0x77 },
  { id: 'f9', label: 'F9', vk: 0x78 },
  { id: 'f10', label: 'F10', vk: 0x79 },
  { id: 'f11', label: 'F11', vk: 0x7A },
  { id: 'f12', label: 'F12', vk: 0x7B },
  { id: 'ins', label: 'Ins', vk: 0x2D },
  { id: 'del', label: 'Del', vk: 0x2E, flex: 1.35, repeatable: true },
];

const letterKey = (ch: string): KeySpec => ({
  id: ch.toLowerCase(),
  label: ch.toLowerCase(),
  shiftLabel: ch.toUpperCase(),
  vk: ch.charCodeAt(0),
  char: ch.toLowerCase(),
  shiftChar: ch.toUpperCase(),
});

const ROW_2: KeySpec[] = [
  { id: 'tab', label: 'Tab', vk: 0x09, flex: 1.3 },
  ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(letterKey),
  { id: 'lbracket', label: '[', shiftLabel: '{', vk: 0xDB, char: '[', shiftChar: '{' },
  { id: 'rbracket', label: ']', shiftLabel: '}', vk: 0xDD, char: ']', shiftChar: '}' },
  { id: 'backslash', label: '\\', shiftLabel: '|', vk: 0xDC, char: '\\', shiftChar: '|', flex: 1.2 },
];

const ROW_3: KeySpec[] = [
  { id: 'caps', label: 'Caps', vk: 0x14, modifier: 'caps', flex: 1.45 },
  ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(letterKey),
  { id: 'semicolon', label: ';', shiftLabel: ':', vk: 0xBA, char: ';', shiftChar: ':' },
  { id: 'quote', label: "'", shiftLabel: '"', vk: 0xDE, char: "'", shiftChar: '"' },
  { id: 'enter', label: 'Enter', vk: 0x0D, flex: 1.65, accent: true },
];

const ROW_4: KeySpec[] = [
  { id: 'shift', label: 'Shift', vk: VK_SHIFT, modifier: 'shift', flex: 1.65 },
  ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(letterKey),
  { id: 'comma', label: ',', shiftLabel: '<', vk: 0xBC, char: ',', shiftChar: '<' },
  { id: 'period', label: '.', shiftLabel: '>', vk: 0xBE, char: '.', shiftChar: '>' },
  { id: 'slash', label: '/', shiftLabel: '?', vk: 0xBF, char: '/', shiftChar: '?' },
  { id: 'up', label: '↑', vk: 0x26, flex: 1.15, repeatable: true },
];

const ROW_5: KeySpec[] = [
  { id: 'fn', label: 'Fn', vk: 0, modifier: 'fn', flex: 1.1 },
  { id: 'ctrl', label: 'Ctrl', vk: VK_CTRL, modifier: 'ctrl', flex: 1.15 },
  { id: 'win', label: 'Win', vk: VK_META, modifier: 'meta', flex: 1.1 },
  { id: 'alt', label: 'Alt', vk: VK_ALT, modifier: 'alt', flex: 1.1 },
  { id: 'space', label: 'Space', vk: 0x20, char: ' ', shiftChar: ' ', flex: 4.2 },
  { id: 'left', label: '←', vk: 0x25, flex: 1.05, repeatable: true },
  { id: 'down', label: '↓', vk: 0x28, flex: 1.05, repeatable: true },
  { id: 'right', label: '→', vk: 0x27, flex: 1.05, repeatable: true },
];

// ------------------------------------------------------------------ nút phím lẻ

const VirtualKeyButton = memo(function VirtualKeyButton({
  spec,
  shifted,
  active,
  height,
  onTrigger,
}: {
  spec: KeySpec;
  shifted: boolean;
  active: boolean;
  height: number;
  onTrigger: (spec: KeySpec) => void;
}) {
  const { colors, glass } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const repeatDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeatDelayRef.current) {
      clearTimeout(repeatDelayRef.current);
      repeatDelayRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const isLetter = spec.id.length === 1 && spec.vk >= 0x41 && spec.vk <= 0x5A;
  const displayLabel = shifted && spec.shiftLabel
    ? spec.shiftLabel
    : isLetter
      ? (shifted ? spec.label.toUpperCase() : spec.label)
      : spec.label;

  return (
    <Press
      focusable={false}
      sound={false}
      pressScale={0.92}
      accessibilityLabel={displayLabel}
      onPressIn={() => {
        playUiSound('select');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onTrigger(spec);
        if (spec.repeatable) {
          stopRepeat();
          repeatDelayRef.current = setTimeout(() => {
            repeatIntervalRef.current = setInterval(() => {
              onTrigger(spec);
            }, 65);
          }, 340);
        }
      }}
      onPressOut={stopRepeat}
      style={[
        styles.keyBtn,
        {
          flex: spec.flex ?? 1,
          height,
          borderRadius: s(6.5),
          backgroundColor: spec.accent
            ? colors.accent
            : active
              ? alpha(colors.accent, 0.32)
              : spec.modifier
                ? 'rgba(255,255,255,0.11)'
                : 'rgba(255,255,255,0.07)',
          borderColor: spec.accent
            ? 'rgba(255,255,255,0.42)'
            : active
              ? colors.accentSoft
              : glass.controlBorder,
        },
      ]}
    >
      <T
        size={displayLabel.length > 2 ? 8.2 : 9.4}
        weight={spec.accent || active ? 'bold' : 'semibold'}
        color={
          spec.accent
            ? colors.onAccent
            : active
              ? '#ffffff'
              : 'rgba(255,255,255,0.9)'
        }
        numberOfLines={1}
      >
        {displayLabel}
      </T>
    </Press>
  );
});

// ------------------------------------------------------------------ component chính

export function VirtualKeyboard({
  client,
  onLocalText,
  onLocalBackspace,
  onLocalSubmit,
  onLocalEscape,
}: {
  /** Client WebRTC đang stream PC (nếu ở màn Stream). */
  client?: NativeMoonlightClient | null;
  /** Callback phụ khi dùng bàn phím ảo ở màn chính (ví dụ ô tìm kiếm Store). */
  onLocalText?: (char: string) => void;
  onLocalBackspace?: () => void;
  onLocalSubmit?: () => void;
  onLocalEscape?: () => void;
}) {
  const { colors, glass, material } = useTheme();
  const styles = useStyles();
  const { s, width, height, insets } = useUi();
  const { open, minimized, dock, dragOffset, setOpen, setMinimized } = useVirtualKeyboardState();

  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);
  const [ctrl, setCtrl] = useState(false);
  const [alt, setAlt] = useState(false);
  const [meta, setMeta] = useState(false);
  const [fn, setFn] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));

  // Kích thước gọn gàng, tuyệt đối không tràn màn hình ngang.
  const availW = Math.max(240, width - insets.left - insets.right - s(16));
  const availH = Math.max(160, height - insets.top - insets.bottom - s(12));
  const kbWidth = Math.min(s(456), Math.round(availW * 0.62), availW);
  const maxKbHeight = Math.min(s(148), Math.round(availH * 0.36));
  const headerH = s(22);
  const padV = s(5);
  const rowGap = s(2.5);
  const keyH = Math.max(s(16.5), Math.min(s(21.5), Math.floor((maxKbHeight - headerH - padV * 2 - rowGap * 4) / 5)));
  const kbHeight = headerH + padV * 2 + keyH * 5 + rowGap * 4;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: open ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade, open]);

  // Nhả mọi phím modifier trên PC khi đóng bàn phím hoặc đổi phiên.
  const clientRef = useRef<NativeMoonlightClient | null | undefined>(null);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  const sendReleaseModifiers = useCallback(() => {
    const target = clientRef.current;
    if (!target) return;
    target.sendKey(false, VK_SHIFT, 0);
    target.sendKey(false, VK_CTRL, 0);
    target.sendKey(false, VK_ALT, 0);
    target.sendKey(false, VK_META, 0);
  }, []);

  useEffect(() => {
    if (!open) sendReleaseModifiers();
  }, [open, sendReleaseModifiers]);

  useEffect(() => () => sendReleaseModifiers(), [sendReleaseModifiers]);

  const closeKeyboard = useCallback(() => {
    sendReleaseModifiers();
    setShift(false);
    setCtrl(false);
    setAlt(false);
    setMeta(false);
    setOpen(false);
  }, [sendReleaseModifiers, setOpen]);

  const flipDock = useCallback(() => {
    playUiSound('navigate');
    flipVirtualKeyboardDock();
  }, []);

  const handleKeyTrigger = useCallback((spec: KeySpec) => {
    if (spec.modifier === 'fn') {
      setFn((v) => !v);
      return;
    }
    if (spec.modifier === 'caps') {
      setCaps((v) => !v);
      clientRef.current?.sendKey(true, 0x14, 0);
      clientRef.current?.sendKey(false, 0x14, 0);
      return;
    }
    if (spec.modifier === 'shift') {
      setShift((prev) => {
        const next = !prev;
        clientRef.current?.sendKey(next, VK_SHIFT, next ? MOD_SHIFT : 0);
        return next;
      });
      return;
    }
    if (spec.modifier === 'ctrl') {
      setCtrl((prev) => {
        const next = !prev;
        clientRef.current?.sendKey(next, VK_CTRL, next ? MOD_CTRL : 0);
        return next;
      });
      return;
    }
    if (spec.modifier === 'alt') {
      setAlt((prev) => {
        const next = !prev;
        clientRef.current?.sendKey(next, VK_ALT, next ? MOD_ALT : 0);
        return next;
      });
      return;
    }
    if (spec.modifier === 'meta') {
      setMeta((prev) => {
        const next = !prev;
        clientRef.current?.sendKey(next, VK_META, next ? MOD_META : 0);
        return next;
      });
      return;
    }

    const isUpper = shift !== caps;
    const isShiftedSymbol = shift;
    const modMask = (
      (isShiftedSymbol || (spec.vk >= 0x41 && spec.vk <= 0x5A && isUpper) ? MOD_SHIFT : 0)
      | (ctrl ? MOD_CTRL : 0)
      | (alt ? MOD_ALT : 0)
      | (meta ? MOD_META : 0)
    );

    const target = clientRef.current;
    if (target) {
      const needTempShift = !shift && (modMask & MOD_SHIFT) !== 0;
      if (needTempShift) target.sendKey(true, VK_SHIFT, modMask);
      target.sendKey(true, spec.vk, modMask);
      target.sendKey(false, spec.vk, modMask);
      if (needTempShift) target.sendKey(false, VK_SHIFT, modMask & ~MOD_SHIFT);
    } else {
      // Ở màn chính (không stream): chuyển phím vào ô tìm kiếm nếu có.
      if (spec.id === 'bs' || spec.id === 'del') onLocalBackspace?.();
      else if (spec.id === 'enter') onLocalSubmit?.();
      else if (spec.id === 'esc') onLocalEscape?.();
      else if (spec.char && !ctrl && !alt && !meta) {
        const isLetter = spec.vk >= 0x41 && spec.vk <= 0x5A;
        const out = isLetter
          ? (isUpper ? (spec.shiftChar ?? spec.char.toUpperCase()) : spec.char)
          : (shift ? (spec.shiftChar ?? spec.char) : spec.char);
        onLocalText?.(out);
      }
    }

    // Nhả các phím modifier dùng 1 lần (Shift / Ctrl / Alt / Win) sau khi gõ phím.
    if (shift) {
      target?.sendKey(false, VK_SHIFT, 0);
      setShift(false);
    }
    if (ctrl) {
      target?.sendKey(false, VK_CTRL, 0);
      setCtrl(false);
    }
    if (alt) {
      target?.sendKey(false, VK_ALT, 0);
      setAlt(false);
    }
    if (meta) {
      target?.sendKey(false, VK_META, 0);
      setMeta(false);
    }
  }, [alt, caps, ctrl, meta, onLocalBackspace, onLocalEscape, onLocalSubmit, onLocalText, shift]);

  if (!open) return null;

  // Khi thu gọn: chỉ hiện viên thuốc nhỏ gọn ở góc để người dùng thấy toàn bộ màn hình
  // trong lúc tìm & chấm vào con trỏ chuột cần nhập.
  if (minimized) {
    return (
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { zIndex: 140, elevation: 140 },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            right: insets.right + s(12),
            bottom: dock === 'bottom' ? insets.bottom + s(10) : undefined,
            top: dock === 'top' ? insets.top + s(10) : undefined,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: s(16),
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: glass.controlBorderActive,
            backgroundColor: alpha(colors.panelSolid, 0.88),
            ...glassShadow,
          }}
        >
          <GlassBackdrop material="panel" radius={s(16)} />
          <Press
            focusable={false}
            onPress={() => setMinimized(false)}
            accessibilityLabel="Mở lại bàn phím ảo"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
              paddingLeft: s(11),
              paddingRight: s(8),
              height: s(30),
            }}
          >
            <KeyboardIcon size={s(14)} color={colors.accentSoft} />
            <T size={10} weight="semibold" color="#ffffff">Bàn phím</T>
          </Press>
          <Press
            focusable={false}
            sound="back"
            onPress={closeKeyboard}
            accessibilityLabel="Đóng bàn phím ảo"
            style={{
              width: s(26),
              height: s(30),
              alignItems: 'center',
              justifyContent: 'center',
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: glass.border,
            }}
          >
            <X size={s(12)} color="rgba(255,255,255,0.68)" />
          </Press>
        </View>
      </View>
    );
  }

  // Tính toạ độ giới hạn trong màn hình để dù kéo đi đâu cũng không bao giờ tràn mép.
  const baseLeft = Math.round((width - kbWidth) / 2);
  const baseTop = dock === 'bottom'
    ? height - insets.bottom - kbHeight - s(8)
    : insets.top + s(8);
  const minX = insets.left + s(6);
  const maxX = Math.max(minX, width - insets.right - kbWidth - s(6));
  const minY = insets.top + s(6);
  const maxY = Math.max(minY, height - insets.bottom - kbHeight - s(6));
  const clampedLeft = Math.min(maxX, Math.max(minX, baseLeft + dragOffset.x));
  const clampedTop = Math.min(maxY, Math.max(minY, baseTop + dragOffset.y));

  const shiftedLetter = shift !== caps;
  const rows: KeySpec[][] = [
    fn ? ROW_1_FN : ROW_1_NORMAL,
    ROW_2,
    ROW_3,
    ROW_4,
    ROW_5,
  ];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 140, elevation: 140, opacity: fade },
      ]}
    >
      <View
        style={[
          styles.keyboardCard,
          {
            position: 'absolute',
            left: clampedLeft,
            top: clampedTop,
            width: kbWidth,
            height: kbHeight,
            borderRadius: s(15),
            paddingHorizontal: s(6),
            paddingBottom: padV,
          },
        ]}
      >
        <GlassBackdrop material="panel" radius={s(15)} />
        <LinearGradient
          colors={material.controlSheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
          pointerEvents="none"
        />

        {/* Thanh tiêu đề mảnh: nắm kéo di chuyển, đổi vị trí Trên/Dưới, thu gọn hoặc đóng */}
        <View
          style={[
            styles.headerBar,
            {
              height: headerH,
              paddingHorizontal: s(4),
            },
          ]}
        >
          <View
            {...headerPanHandlers}
            style={{
              flex: 1,
              height: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            <KeyboardIcon size={s(12)} color={colors.accentSoft} />
            <T size={9.2} weight="semibold" color="rgba(255,255,255,0.78)" numberOfLines={1}>
              Bàn phím ảo · kéo để di chuyển
            </T>
            <View
              style={{
                width: s(28),
                height: s(3),
                borderRadius: s(1.5),
                backgroundColor: 'rgba(255,255,255,0.24)',
                marginLeft: s(4),
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
            <Press
              focusable={false}
              onPress={flipDock}
              hitSlop={6}
              accessibilityLabel={dock === 'bottom' ? 'Chuyển bàn phím lên trên' : 'Chuyển bàn phím xuống dưới'}
              style={[styles.headerActionBtn, { width: s(22), height: s(17), borderRadius: s(6) }]}
            >
              {dock === 'bottom' ? (
                <ChevronUp size={s(12)} color="rgba(255,255,255,0.78)" />
              ) : (
                <ChevronDown size={s(12)} color="rgba(255,255,255,0.78)" />
              )}
            </Press>
            <Press
              focusable={false}
              onPress={() => setMinimized(true)}
              hitSlop={6}
              accessibilityLabel="Thu gọn bàn phím ảo"
              style={[styles.headerActionBtn, { width: s(22), height: s(17), borderRadius: s(6) }]}
            >
              <Minus size={s(12)} color="rgba(255,255,255,0.78)" />
            </Press>
            <Press
              focusable={false}
              sound="back"
              onPress={closeKeyboard}
              hitSlop={6}
              accessibilityLabel="Đóng bàn phím ảo"
              style={[styles.headerActionBtn, { width: s(22), height: s(17), borderRadius: s(6) }]}
            >
              <X size={s(12)} color="rgba(255,255,255,0.78)" />
            </Press>
          </View>
        </View>

        {/* Lưới 5 hàng phím thu gọn */}
        <View style={{ flex: 1, gap: rowGap, justifyContent: 'space-between' }}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: s(2.5), height: keyH }}>
              {row.map((spec) => {
                const isModActive = (spec.modifier === 'shift' && shift)
                  || (spec.modifier === 'caps' && caps)
                  || (spec.modifier === 'ctrl' && ctrl)
                  || (spec.modifier === 'alt' && alt)
                  || (spec.modifier === 'meta' && meta)
                  || (spec.modifier === 'fn' && fn);
                const isLetter = spec.vk >= 0x41 && spec.vk <= 0x5A;
                return (
                  <VirtualKeyButton
                    key={spec.id}
                    spec={spec}
                    shifted={isLetter ? shiftedLetter : shift}
                    active={isModActive}
                    height={keyH}
                    onTrigger={handleKeyTrigger}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, glass }) => ({
  keyboardCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.panelBorder,
    backgroundColor: alpha(colors.panelSolid, 0.84),
    ...glassShadow,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.controlBorder,
  },
  keyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
}));
