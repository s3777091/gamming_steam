// Bàn phím ảo nổi dạng kính mờ (compact landscape), dùng trong lúc stream PC
// và trên màn chính. Không chặn vùng chạm xung quanh (pointerEvents="box-none")
// để người dùng vừa chấm chuột vào ô nhập trên PC vừa bấm phím ngay.
//
// Hai chế độ theo nơi đặt bàn phím:
//  - Remote (màn stream, có `client`): phím đi thẳng sang PC qua Moonlight.
//  - Local (màn chính, không có `client`): phím đổ vào ô nhập của app qua onLocal*.
//
// Tay cầm điều khiển được bàn phím: D-pad / cần trái chọn phím, A gõ, X xoá, Y cách,
// LB/RB dời con trỏ, LT Shift, RT đổi VI/EN, Start Enter, B đóng. Thanh trên cùng là
// các phím chức năng: ngôn ngữ nhập (EN / VI Telex), chọn hết, sao chép, dán và
// danh sách những gì đã sao chép gần đây.
//
// Kích thước luôn thu gọn theo khung màn hình ngang và tự tránh vùng con trỏ
// chuột hoặc cho phép kéo / lật Trên-Dưới / thu gọn thành viên thuốc nhỏ.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { addListener, getDevices, type GamepadButtonName } from 'jetsona-input';
import {
  ChevronDown, ChevronUp, ClipboardList, ClipboardPaste, Copy, Keyboard as KeyboardIcon, Languages, Minus,
  SquareDashedText, Trash2, X, type LucideIcon,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { Direction } from '@/features/gamepad/focus';
import { useBack, useSuspendCursor } from '@/features/gamepad/hooks';
import { navDirection, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from '@/features/gamepad/navigation';
import { isNavigatorEnabled } from '@/features/gamepad/registry';
import { playUiSound, type UiSound } from '@/features/sound/UiSoundProvider';
import type { NativeMoonlightClient } from '@/lib/moonlight-native';
import { PC_ROUTES, pcFetch } from '@/lib/pc-api';
import { applyTelex, diffWord } from '@/lib/telex';
import { alpha, glassShadow, makeStyles, useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

// ------------------------------------------------------------------ trạng thái dùng chung

export type InputLanguage = 'en' | 'vi';

let currentOpen = false;
let currentMinimized = false;
let currentDock: 'bottom' | 'top' = 'bottom';
let currentDragOffset = { x: 0, y: 0 };
let dragBaseOffset = { x: 0, y: 0 };
let isManualDragged = false;
let currentLanguage: InputLanguage = 'en';
let clipHistory: string[] = [];
let extrasLoaded = false;
/** Tăng mỗi lần chạm chuột trên màn stream: con trỏ PC đã dời nên bỏ từ Telex đang gõ dở. */
let composeEpoch = 0;
const listeners = new Set<() => void>();

const LANGUAGE_STORAGE = 'jetsona.virtualKeyboard.language';
const CLIPS_STORAGE = 'jetsona.virtualKeyboard.clips';
const MAX_CLIPS = 12;
const MAX_PASTE_CHARS = 4000;

function notify() {
  listeners.forEach((listener) => listener());
}

function loadKeyboardExtras(): void {
  if (extrasLoaded) return;
  extrasLoaded = true;
  void AsyncStorage.multiGet([LANGUAGE_STORAGE, CLIPS_STORAGE]).then(([[, language], [, clips]]) => {
    if (language === 'vi' || language === 'en') currentLanguage = language;
    try {
      const parsed: unknown = clips ? JSON.parse(clips) : null;
      if (Array.isArray(parsed)) {
        clipHistory = parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_CLIPS);
      }
    } catch {
      // Dữ liệu cũ hỏng: bắt đầu lại danh sách trống.
    }
    notify();
  }).catch(() => {});
}

function setInputLanguage(language: InputLanguage): void {
  currentLanguage = language;
  notify();
  void AsyncStorage.setItem(LANGUAGE_STORAGE, language).catch(() => {});
}

function saveClips(): void {
  notify();
  void AsyncStorage.setItem(CLIPS_STORAGE, JSON.stringify(clipHistory)).catch(() => {});
}

function rememberClip(text: string): void {
  if (!text.trim()) return;
  clipHistory = [text, ...clipHistory.filter((item) => item !== text)].slice(0, MAX_CLIPS);
  saveClips();
}

function clearClips(): void {
  clipHistory = [];
  saveClips();
}

function clipPreview(text: string, max = 28): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
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
  composeEpoch += 1;
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
  language: InputLanguage;
  clips: string[];
  setOpen: (open: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  toggle: () => void;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadKeyboardExtras();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return {
    open: currentOpen,
    minimized: currentMinimized,
    dock: currentDock,
    dragOffset: currentDragOffset,
    language: currentLanguage,
    clips: clipHistory,
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
const VK_BACKSPACE = 0x08;

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
  { id: 'bs', label: '⌫', vk: VK_BACKSPACE, flex: 1.35, repeatable: true },
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

const KEY_BY_ID = new Map(
  [...ROW_1_FN, ...ROW_1_NORMAL, ...ROW_2, ...ROW_3, ...ROW_4, ...ROW_5].map((spec) => [spec.id, spec]),
);

/** Ô mặc định khi tay cầm bắt đầu chọn: phím G (hàng 3 của lưới, hàng toolbar là 0). */
const DEFAULT_NAV = { row: 3, col: ROW_3.findIndex((spec) => spec.id === 'g') };

/** Tâm phím theo tỉ lệ bề ngang hàng (0..1), dùng để lên/xuống hàng vào phím thẳng cột. */
function keyCenter(row: KeySpec[], col: number): number {
  let before = 0;
  let total = 0;
  row.forEach((spec, index) => {
    const flex = spec.flex ?? 1;
    if (index < col) before += flex;
    total += flex;
  });
  return (before + (row[col]?.flex ?? 1) / 2) / Math.max(1, total);
}

function nearestIndex(count: number, centerOf: (index: number) => number, target: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < count; index += 1) {
    const distance = Math.abs(centerOf(index) - target);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

function tapKey(target: NativeMoonlightClient, vk: number, modifiers = 0): void {
  target.sendKey(true, vk, modifiers);
  target.sendKey(false, vk, modifiers);
}

// ------------------------------------------------------------------ nút phím lẻ

const VirtualKeyButton = memo(function VirtualKeyButton({
  spec,
  shifted,
  active,
  focused,
  height,
  onTrigger,
  onTouch,
}: {
  spec: KeySpec;
  shifted: boolean;
  active: boolean;
  /** Ô đang được tay cầm chọn. */
  focused: boolean;
  height: number;
  onTrigger: (spec: KeySpec) => void;
  onTouch: () => void;
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
        onTouch();
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
          borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
          backgroundColor: spec.accent
            ? colors.accent
            : active
              ? alpha(colors.accent, 0.32)
              : focused
                ? 'rgba(255,255,255,0.24)'
                : spec.modifier
                  ? 'rgba(255,255,255,0.11)'
                  : 'rgba(255,255,255,0.07)',
          borderColor: focused
            ? '#ffffff'
            : spec.accent
              ? 'rgba(255,255,255,0.42)'
              : active
                ? colors.accentSoft
                : glass.controlBorder,
          transform: focused ? [{ scale: 1.08 }] : undefined,
          zIndex: focused ? 2 : 0,
        },
      ]}
    >
      <T
        size={displayLabel.length > 2 ? 8.2 : 9.4}
        weight={spec.accent || active || focused ? 'bold' : 'semibold'}
        color={
          spec.accent
            ? colors.onAccent
            : active || focused
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

// ------------------------------------------------------------------ phím chức năng trên thanh tiêu đề

type ToolItem = {
  id: string;
  icon: LucideIcon;
  label?: string;
  /** Đang bật (VI, danh sách mở...). */
  highlighted?: boolean;
  accessibilityLabel: string;
  sound?: UiSound | false;
};

const ToolButton = memo(function ToolButton({
  item,
  focused,
  height,
  onPressTool,
  onLayoutItem,
}: {
  item: ToolItem;
  focused: boolean;
  height: number;
  onPressTool: (id: string) => void;
  onLayoutItem: (id: string, event: LayoutChangeEvent) => void;
}) {
  const { colors, glass } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const { icon: Icon, label, highlighted } = item;
  const tint = highlighted || focused ? '#ffffff' : 'rgba(255,255,255,0.78)';
  return (
    <Press
      focusable={false}
      sound={item.sound ?? 'select'}
      hitSlop={4}
      pressScale={0.92}
      onPress={() => onPressTool(item.id)}
      onLayout={(event) => onLayoutItem(item.id, event)}
      accessibilityLabel={item.accessibilityLabel}
      style={[
        styles.toolBtn,
        {
          height,
          minWidth: s(22),
          gap: s(3),
          paddingHorizontal: label ? s(6) : 0,
          borderRadius: s(6),
          borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
          backgroundColor: highlighted
            ? alpha(colors.accent, 0.34)
            : focused
              ? 'rgba(255,255,255,0.24)'
              : 'rgba(255,255,255,0.08)',
          borderColor: focused ? '#ffffff' : highlighted ? colors.accentSoft : glass.controlBorder,
          transform: focused ? [{ scale: 1.08 }] : undefined,
        },
      ]}
    >
      <Icon size={s(11)} color={tint} />
      {label ? (
        <T size={8.4} weight={highlighted || focused ? 'bold' : 'semibold'} color={tint} numberOfLines={1}>
          {label}
        </T>
      ) : null}
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
  /**
   * Màn Stream truyền client WebRTC (kể cả `null` khi kênh nhập chưa sẵn sàng):
   * bàn phím ở chế độ remote, mọi phím gửi sang PC. Bỏ trống = chế độ local.
   */
  client?: NativeMoonlightClient | null;
  /** Callback khi dùng bàn phím ảo ở màn chính (ví dụ ô tìm kiếm Store). */
  onLocalText?: (text: string) => void;
  onLocalBackspace?: () => void;
  onLocalSubmit?: () => void;
  onLocalEscape?: () => void;
}) {
  const { colors, glass, material } = useTheme();
  const styles = useStyles();
  const { s, width, height, insets } = useUi();
  const { open, minimized, dock, dragOffset, language, clips, setOpen, setMinimized } = useVirtualKeyboardState();
  const remote = client !== undefined;
  // Màn chính vẫn mount bên dưới màn stream: chỉ bản bàn phím của màn đang hiện mới
  // được nghe tay cầm / Back, kẻo bản local ẩn bấm trùng (vd. đóng bàn phím) khi đang remote.
  const focused = useIsFocused();

  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);
  const [ctrl, setCtrl] = useState(false);
  const [alt, setAlt] = useState(false);
  const [meta, setMeta] = useState(false);
  const [fn, setFn] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));

  // Tay cầm: ô đang chọn (hàng 0 = thanh chức năng, 1..5 = lưới phím).
  const [nav, setNav] = useState(DEFAULT_NAV);
  const [padActive, setPadActive] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const historyScrollRef = useRef<ScrollView>(null);
  const toolLayouts = useRef(new Map<string, { x: number; w: number }>());
  const headerWidth = useRef(1);
  const composeRef = useRef({ word: '', epoch: composeEpoch });

  // Kích thước gọn gàng, tuyệt đối không tràn màn hình ngang.
  const availW = Math.max(240, width - insets.left - insets.right - s(16));
  const availH = Math.max(160, height - insets.top - insets.bottom - s(12));
  const kbWidth = Math.min(s(456), Math.round(availW * 0.62), availW);
  const maxKbHeight = Math.min(s(148), Math.round(availH * 0.36));
  const headerH = s(24);
  const toolH = s(17);
  const padV = s(5);
  const rowGap = s(2.5);
  const keyH = Math.max(s(16.5), Math.min(s(21.5), Math.floor((maxKbHeight - headerH - padV * 2 - rowGap * 4) / 5)));
  const kbHeight = headerH + padV * 2 + keyH * 5 + rowGap * 4;
  const historyRowH = s(21);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: open ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade, open]);

  // Mở bàn phím khi đang cầm tay cầm: hiện ngay ô đang chọn để khỏi phải bấm thử.
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) setPadActive(getDevices().some((device) => device.kind === 'controller' && device.connected !== false));
    else setHistoryOpen(false);
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

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
    if (!open || !focused) sendReleaseModifiers();
  }, [focused, open, sendReleaseModifiers]);

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

  /** Từ Telex đang gõ dở; chạm chuột trên PC (dời con trỏ) thì bỏ. */
  const composingWord = useCallback(() => {
    const compose = composeRef.current;
    if (compose.epoch !== composeEpoch) {
      compose.word = '';
      compose.epoch = composeEpoch;
    }
    return compose.word;
  }, []);

  /** Nhả các phím modifier dùng 1 lần (Shift / Ctrl / Alt / Win) sau khi gõ phím. */
  const releaseOneShot = useCallback(() => {
    const target = clientRef.current;
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
  }, [alt, ctrl, meta, shift]);

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

    const target = clientRef.current;
    const isLetter = spec.vk >= 0x41 && spec.vk <= 0x5A;
    const isUpper = shift !== caps;
    const compose = composeRef.current;
    const word = composingWord();

    // Tiếng Việt (Telex): ghép chữ cái vào từ đang gõ, chỉ gõ lại phần bị đổi dấu.
    if (language === 'vi' && isLetter && spec.char && !ctrl && !alt && !meta) {
      const typed = isUpper ? (spec.shiftChar ?? spec.char.toUpperCase()) : spec.char;
      const next = applyTelex(word, typed);
      compose.word = next;
      const { erase, insert } = diffWord(word, next);
      if (erase > 0 || insert !== typed) {
        if (target) {
          for (let index = 0; index < erase; index += 1) tapKey(target, VK_BACKSPACE);
          if (insert) target.sendText(insert);
        } else if (!remote) {
          for (let index = 0; index < erase; index += 1) onLocalBackspace?.();
          if (insert) onLocalText?.(insert);
        }
        releaseOneShot();
        return;
      }
    } else if (spec.id === 'bs') {
      compose.word = Array.from(word).slice(0, -1).join('');
    } else {
      compose.word = '';
    }

    const isShiftedSymbol = shift;
    const modMask = (
      (isShiftedSymbol || (isLetter && isUpper) ? MOD_SHIFT : 0)
      | (ctrl ? MOD_CTRL : 0)
      | (alt ? MOD_ALT : 0)
      | (meta ? MOD_META : 0)
    );

    if (target) {
      const needTempShift = !shift && (modMask & MOD_SHIFT) !== 0;
      if (needTempShift) target.sendKey(true, VK_SHIFT, modMask);
      target.sendKey(true, spec.vk, modMask);
      target.sendKey(false, spec.vk, modMask);
      if (needTempShift) target.sendKey(false, VK_SHIFT, modMask & ~MOD_SHIFT);
    } else if (!remote) {
      // Ở màn chính (không stream): chuyển phím vào ô nhập của app.
      if (spec.id === 'bs' || spec.id === 'del') onLocalBackspace?.();
      else if (spec.id === 'enter') onLocalSubmit?.();
      else if (spec.id === 'esc') onLocalEscape?.();
      else if (spec.char && !ctrl && !alt && !meta) {
        const out = isLetter
          ? (isUpper ? (spec.shiftChar ?? spec.char.toUpperCase()) : spec.char)
          : (shift ? (spec.shiftChar ?? spec.char) : spec.char);
        onLocalText?.(out);
      }
    }

    releaseOneShot();
  }, [alt, caps, composingWord, ctrl, language, meta, onLocalBackspace, onLocalEscape, onLocalSubmit, onLocalText, releaseOneShot, remote, shift]);

  // ---------------------------------------------------------------- phím chức năng

  const showNotice = useCallback((message: string) => setNotice(message), []);

  /** Gõ cả đoạn chữ: remote gửi Unicode sang PC, local đổ vào ô nhập của app. */
  const typeText = useCallback((text: string) => {
    const clipped = text.slice(0, MAX_PASTE_CHARS);
    composeRef.current.word = '';
    const target = clientRef.current;
    if (target) {
      releaseOneShot();
      target.sendText(clipped);
      return true;
    }
    if (remote) return false;
    onLocalText?.(clipped.replace(/\s+/g, ' '));
    return true;
  }, [onLocalText, releaseOneShot, remote]);

  const toggleLanguage = useCallback(() => {
    const next: InputLanguage = currentLanguage === 'vi' ? 'en' : 'vi';
    setInputLanguage(next);
    composeRef.current.word = '';
    showNotice(next === 'vi' ? 'Tiếng Việt (Telex)' : 'English');
  }, [showNotice]);

  const sendShortcut = useCallback((vk: number) => {
    const target = clientRef.current;
    if (!target) return false;
    releaseOneShot();
    composeRef.current.word = '';
    target.sendKey(true, VK_CTRL, MOD_CTRL);
    tapKey(target, vk, MOD_CTRL);
    target.sendKey(false, VK_CTRL, 0);
    return true;
  }, [releaseOneShot]);

  const selectAll = useCallback(() => {
    if (sendShortcut(0x41)) showNotice('Đã chọn tất cả (Ctrl+A)');
  }, [sendShortcut, showNotice]);

  // Sao chép: Ctrl+C trên PC rồi kéo chữ về điện thoại và lưu vào danh sách.
  const copyFromPc = useCallback(async () => {
    if (!sendShortcut(0x43)) return;
    showNotice('Đang sao chép…');
    await new Promise((resolve) => setTimeout(resolve, 450));
    try {
      const response = await pcFetch(PC_ROUTES.clipboard, { cache: 'no-store' });
      const data = await response.json().catch(() => null) as { ok?: boolean; text?: string } | null;
      if (data?.ok && data.text) {
        rememberClip(data.text);
        await Clipboard.setStringAsync(data.text).catch(() => {});
        showNotice(`Đã chép: ${clipPreview(data.text)}`);
      } else {
        showNotice('Chưa có chữ nào được chọn trên máy tính');
      }
    } catch {
      showNotice('Không đọc được clipboard của máy tính');
    }
  }, [sendShortcut, showNotice]);

  // Dán: chữ trong clipboard của điện thoại.
  const pasteFromPhone = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        showNotice('Clipboard của điện thoại đang trống');
        return;
      }
      rememberClip(text);
      if (typeText(text)) showNotice(remote ? 'Đã dán sang máy tính' : 'Đã dán');
    } catch {
      showNotice('Không đọc được clipboard');
    }
  }, [remote, showNotice, typeText]);

  const pasteClip = useCallback((text: string) => {
    rememberClip(text);
    setHistoryOpen(false);
    if (typeText(text)) showNotice(`Đã dán: ${clipPreview(text)}`);
  }, [showNotice, typeText]);

  const toggleHistory = useCallback(() => {
    setHistoryIndex(0);
    setHistoryOpen((value) => !value);
  }, []);

  const runTool = useCallback((id: string) => {
    switch (id) {
      case 'lang': toggleLanguage(); break;
      case 'selectAll': selectAll(); break;
      case 'copy': void copyFromPc(); break;
      case 'paste': void pasteFromPhone(); break;
      case 'clips': toggleHistory(); break;
      case 'flip': flipDock(); break;
      case 'minimize': setMinimized(true); break;
      case 'close': closeKeyboard(); break;
    }
  }, [closeKeyboard, copyFromPc, flipDock, pasteFromPhone, selectAll, setMinimized, toggleHistory, toggleLanguage]);

  const tools: ToolItem[] = [
    {
      id: 'lang',
      icon: Languages,
      label: language === 'vi' ? 'VI' : 'EN',
      highlighted: language === 'vi',
      accessibilityLabel: language === 'vi' ? 'Đang gõ tiếng Việt, bấm để chuyển sang tiếng Anh' : 'Đang gõ tiếng Anh, bấm để chuyển sang tiếng Việt',
    },
    ...(remote ? [
      { id: 'selectAll', icon: SquareDashedText, label: 'Chọn hết', accessibilityLabel: 'Chọn tất cả trên máy tính' },
      { id: 'copy', icon: Copy, label: 'Chép', accessibilityLabel: 'Sao chép chữ đang chọn trên máy tính' },
    ] : []),
    { id: 'paste', icon: ClipboardPaste, label: 'Dán', accessibilityLabel: 'Dán chữ từ clipboard điện thoại' },
    {
      id: 'clips',
      icon: ClipboardList,
      label: clips.length ? String(clips.length) : undefined,
      highlighted: historyOpen,
      accessibilityLabel: 'Danh sách đã sao chép gần đây',
    },
  ];
  const headerActions: ToolItem[] = [
    {
      id: 'flip',
      icon: dock === 'bottom' ? ChevronUp : ChevronDown,
      accessibilityLabel: dock === 'bottom' ? 'Chuyển bàn phím lên trên' : 'Chuyển bàn phím xuống dưới',
      sound: false,
    },
    { id: 'minimize', icon: Minus, accessibilityLabel: 'Thu gọn bàn phím ảo' },
    { id: 'close', icon: X, accessibilityLabel: 'Đóng bàn phím ảo', sound: 'back' },
  ];
  const toolbar = [...tools, ...headerActions];
  const keyRows: KeySpec[][] = [fn ? ROW_1_FN : ROW_1_NORMAL, ROW_2, ROW_3, ROW_4, ROW_5];
  const navRow = Math.min(Math.max(0, nav.row), keyRows.length);
  const navCount = navRow === 0 ? toolbar.length : keyRows[navRow - 1].length;
  const navCol = Math.min(Math.max(0, nav.col), navCount - 1);
  const historyCount = clips.length ? clips.length + 1 : 0;

  const onToolLayout = useCallback((id: string, event: LayoutChangeEvent) => {
    const { x, width: w } = event.nativeEvent.layout;
    toolLayouts.current.set(id, { x, w });
  }, []);

  const onKeyTouch = useCallback(() => setPadActive(false), []);

  // ---------------------------------------------------------------- điều khiển bằng tay cầm

  const back = useCallback(() => {
    if (historyOpen) setHistoryOpen(false);
    else closeKeyboard();
  }, [closeKeyboard, historyOpen]);

  const pressKey = useCallback((id: string) => {
    const spec = KEY_BY_ID.get(id);
    if (!spec) return;
    playUiSound('select');
    setFlashId(spec.id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 120);
    handleKeyTrigger(spec);
  }, [handleKeyTrigger]);

  /** Lần bấm đầu khi chưa thấy ô chọn (vừa gõ bằng tay): chỉ hiện ô chọn, chưa làm gì. */
  const wakePad = () => {
    if (padActive) return true;
    setPadActive(true);
    return false;
  };

  const onPadDirection = useEffectEvent((direction: Direction) => {
    if (!wakePad()) return;
    if (historyOpen) {
      if (direction === 'up' || direction === 'down') {
        const next = Math.min(historyCount - 1, Math.max(0, historyIndex + (direction === 'down' ? 1 : -1)));
        if (next !== historyIndex) playUiSound('navigate');
        setHistoryIndex(next);
      }
      return;
    }
    const toolCenter = (index: number) => {
      const layout = toolLayouts.current.get(toolbar[index]?.id ?? '');
      return layout ? (layout.x + layout.w / 2) / Math.max(1, headerWidth.current) : (index + 0.5) / toolbar.length;
    };
    const centerOf = (row: number, col: number) => (row === 0 ? toolCenter(col) : keyCenter(keyRows[row - 1], col));
    let row = navRow;
    let col = navCol;
    if (direction === 'left' || direction === 'right') {
      col = Math.min(navCount - 1, Math.max(0, col + (direction === 'right' ? 1 : -1)));
    } else {
      const nextRow = Math.min(keyRows.length, Math.max(0, row + (direction === 'down' ? 1 : -1)));
      if (nextRow === row) return;
      const target = centerOf(row, col);
      col = nextRow === 0
        ? nearestIndex(toolbar.length, toolCenter, target)
        : nearestIndex(keyRows[nextRow - 1].length, (index) => keyCenter(keyRows[nextRow - 1], index), target);
      row = nextRow;
    }
    if (row === navRow && col === navCol) return;
    playUiSound('navigate');
    setNav({ row, col });
  });

  const activateFocused = () => {
    if (historyOpen) {
      if (historyIndex < clips.length) pasteClip(clips[historyIndex]);
      else if (historyCount) {
        clearClips();
        setHistoryOpen(false);
      }
      return;
    }
    if (navRow === 0) {
      const item = toolbar[navCol];
      if (!item) return;
      if (item.sound !== false) playUiSound(item.sound ?? 'select');
      runTool(item.id);
      return;
    }
    const spec = keyRows[navRow - 1][navCol];
    if (spec) pressKey(spec.id);
  };

  const onPadButton = useEffectEvent((button: GamepadButtonName) => {
    const awake = wakePad();
    switch (button) {
      case 'a': if (awake) activateFocused(); break;
      // Màn chính đã nhận B qua useBack (bộ điều hướng gọi dispatchBack).
      case 'b': if (!isNavigatorEnabled()) back(); break;
      case 'x': pressKey('bs'); break;
      case 'y': pressKey('space'); break;
      case 'lb': pressKey('left'); break;
      case 'rb': pressKey('right'); break;
      case 'start': pressKey('enter'); break;
      case 'lt':
      case 'l3': pressKey('shift'); break;
      case 'rt':
      case 'r3': playUiSound('select'); toggleLanguage(); break;
      default: break;
    }
  });

  // Bàn phím đang bung thì nó giữ tay cầm: màn chính thôi di chuyển tiêu điểm bên dưới,
  // màn stream thôi gửi tay cầm sang game (xem keyboardHoldsPad ở StreamScreen).
  const controllerActive = open && !minimized && focused;
  useSuspendCursor(controllerActive);
  // Màn chính: B / nút Back hệ thống đi qua ngăn xếp Back. Màn stream: chỉ nút Back hệ thống.
  useBack(back, controllerActive);

  useEffect(() => {
    if (!controllerActive) return;
    const directions = new Map<number, Direction | null>();
    let held: Direction | null = null;
    let repeat: ReturnType<typeof setTimeout> | undefined;

    const hold = (next: Direction | null) => {
      if (next === held) return;
      held = next;
      clearTimeout(repeat);
      if (!next) return;
      onPadDirection(next);
      const tick = () => {
        if (held !== next) return;
        onPadDirection(next);
        repeat = setTimeout(tick, REPEAT_INTERVAL_MS);
      };
      repeat = setTimeout(tick, REPEAT_DELAY_MS);
    };

    const offState = addListener('onGamepadState', (state) => {
      directions.set(state.deviceId, navDirection(state, directions.get(state.deviceId) ?? null));
      let next: Direction | null = null;
      for (const direction of directions.values()) {
        if (direction) { next = direction; break; }
      }
      hold(next);
    });
    const offDevices = addListener('onDevicesChanged', () => {
      directions.clear();
      hold(null);
    });
    const offButton = addListener('onGamepadButton', (event) => {
      if (event.down) onPadButton(event.button);
    });

    return () => {
      offState();
      offDevices();
      offButton();
      clearTimeout(repeat);
    };
  }, [controllerActive]);

  // Danh sách đã sao chép: cuộn theo ô tay cầm đang chọn.
  useEffect(() => {
    if (!historyOpen) return;
    historyScrollRef.current?.scrollTo({ y: Math.max(0, (historyIndex - 1) * historyRowH), animated: true });
  }, [historyIndex, historyOpen, historyRowH]);

  if (!open || !focused) return null;

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
            <T size={10} weight="semibold" color="#ffffff">Bàn phím · {language === 'vi' ? 'VI' : 'EN'}</T>
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
  const showFocus = padActive;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 140, elevation: 140, opacity: fade },
      ]}
    >
      {notice ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: clampedLeft,
            width: kbWidth,
            alignItems: 'center',
            ...(dock === 'bottom' ? { top: clampedTop - s(22) } : { top: clampedTop + kbHeight + s(5) }),
          }}
        >
          <View style={[styles.caption, { borderRadius: s(9), paddingHorizontal: s(9), paddingVertical: s(3) }]}>
            <T size={8.6} weight="semibold" color="#ffffff" numberOfLines={1}>
              {notice}
            </T>
          </View>
        </View>
      ) : null}

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

        {/* Thanh chức năng: ngôn ngữ, chọn hết, chép, dán, danh sách đã chép | nắm kéo | lật, thu gọn, đóng */}
        <View
          onLayout={(event) => { headerWidth.current = event.nativeEvent.layout.width; }}
          style={[
            styles.headerBar,
            {
              height: headerH,
              gap: s(4),
            },
          ]}
        >
          {tools.map((item, index) => (
            <ToolButton
              key={item.id}
              item={item}
              focused={showFocus && !historyOpen && navRow === 0 && navCol === index}
              height={toolH}
              onPressTool={runTool}
              onLayoutItem={onToolLayout}
            />
          ))}

          <View
            {...headerPanHandlers}
            accessibilityLabel="Kéo để di chuyển bàn phím"
            style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: s(28),
                height: s(3),
                borderRadius: s(1.5),
                backgroundColor: 'rgba(255,255,255,0.24)',
              }}
            />
          </View>

          {headerActions.map((item, index) => (
            <ToolButton
              key={item.id}
              item={item}
              focused={showFocus && !historyOpen && navRow === 0 && navCol === tools.length + index}
              height={toolH}
              onPressTool={runTool}
              onLayoutItem={onToolLayout}
            />
          ))}
        </View>

        {/* Lưới 5 hàng phím thu gọn */}
        <View style={{ flex: 1, gap: rowGap, justifyContent: 'space-between' }}>
          {keyRows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: s(2.5), height: keyH }}>
              {row.map((spec, colIndex) => {
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
                    active={isModActive || flashId === spec.id}
                    focused={showFocus && !historyOpen && navRow === rowIndex + 1 && navCol === colIndex}
                    height={keyH}
                    onTrigger={handleKeyTrigger}
                    onTouch={onKeyTouch}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Danh sách đã sao chép gần đây: phủ lên lưới phím, chạm / A để dán lại */}
        {historyOpen ? (
          <View
            style={[
              styles.historyPanel,
              {
                top: headerH,
                left: s(6),
                right: s(6),
                bottom: padV,
                borderRadius: s(9),
              },
            ]}
          >
            {clips.length ? (
              <ScrollView ref={historyScrollRef} contentContainerStyle={{ padding: s(3), gap: s(2) }}>
                {clips.map((text, index) => {
                  const focused = showFocus && historyIndex === index;
                  return (
                    <Press
                      key={`${index}-${text.slice(0, 16)}`}
                      focusable={false}
                      pressScale={0.98}
                      onPress={() => pasteClip(text)}
                      accessibilityLabel={`Dán: ${clipPreview(text, 60)}`}
                      style={[
                        styles.historyRow,
                        {
                          height: historyRowH - s(2),
                          borderRadius: s(6),
                          paddingHorizontal: s(8),
                          borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
                          borderColor: focused ? '#ffffff' : glass.controlBorder,
                          backgroundColor: focused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                        },
                      ]}
                    >
                      <T size={9} weight="medium" color="rgba(255,255,255,0.9)" numberOfLines={1}>
                        {clipPreview(text, 80)}
                      </T>
                    </Press>
                  );
                })}
                <Press
                  focusable={false}
                  sound="back"
                  onPress={() => { clearClips(); setHistoryOpen(false); }}
                  accessibilityLabel="Xoá danh sách đã sao chép"
                  style={[
                    styles.historyRow,
                    {
                      height: historyRowH - s(2),
                      borderRadius: s(6),
                      paddingHorizontal: s(8),
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s(5),
                      borderWidth: showFocus && historyIndex === clips.length ? 1.5 : 0,
                      borderColor: '#ffffff',
                    },
                  ]}
                >
                  <Trash2 size={s(10)} color={colors.danger} />
                  <T size={8.6} weight="semibold" color={colors.danger}>Xoá danh sách</T>
                </Press>
              </ScrollView>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(16) }}>
                <T size={9} color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>
                  Chưa có gì. Bấm {remote ? '“Chép” hoặc “Dán”' : '“Dán”'} để lưu chữ vào đây và dán lại nhanh.
                </T>
              </View>
            )}
          </View>
        ) : null}
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
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  caption: {
    backgroundColor: alpha(colors.panelSolid, 0.9),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.controlBorder,
  },
  historyPanel: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: alpha(colors.panelSolid, 0.97),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.controlBorder,
  },
  historyRow: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
}));
