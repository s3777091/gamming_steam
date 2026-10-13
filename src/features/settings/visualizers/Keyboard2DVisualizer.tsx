// Trình trực quan hoá 2D bàn phím máy tính theo thời gian thực (Digital Twin Keyboard)
// Bắt sự kiện phím vật lý từ cổng Android native và làm sáng các phím tương ứng trên mô hình 2D.
// Hiển thị mã phím, mã web, Virtual Key (VK), phím bổ trợ (Shift/Ctrl/Alt/Meta) và N-Key Rollover.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  addListener,
  setCaptureMode,
} from 'jetsona-input';

import { appleColors } from '@/features/settings/controls';
import { webCodeForKeyCode } from '@/features/settings/keycodes';
import { Press } from '@/ui/Press';
import { T } from '@/ui/Text';

export type KeyItem = {
  code: string;
  label: string;
  subLabel?: string;
  flex?: number;
  width?: number;
};

// Định nghĩa ma trận bàn phím chuẩn 75% ANSI
const KEYBOARD_ROWS: KeyItem[][] = [
  // Hàng F: Function keys
  [
    { code: 'Escape', label: 'ESC', flex: 1.2 },
    { code: 'F1', label: 'F1', flex: 1 },
    { code: 'F2', label: 'F2', flex: 1 },
    { code: 'F3', label: 'F3', flex: 1 },
    { code: 'F4', label: 'F4', flex: 1 },
    { code: 'F5', label: 'F5', flex: 1 },
    { code: 'F6', label: 'F6', flex: 1 },
    { code: 'F7', label: 'F7', flex: 1 },
    { code: 'F8', label: 'F8', flex: 1 },
    { code: 'F9', label: 'F9', flex: 1 },
    { code: 'F10', label: 'F10', flex: 1 },
    { code: 'F11', label: 'F11', flex: 1 },
    { code: 'F12', label: 'F12', flex: 1 },
    { code: 'Delete', label: 'DEL', flex: 1.2 },
  ],
  // Hàng số
  [
    { code: 'Backquote', label: '~', subLabel: '`', flex: 1 },
    { code: 'Digit1', label: '1', subLabel: '!', flex: 1 },
    { code: 'Digit2', label: '2', subLabel: '@', flex: 1 },
    { code: 'Digit3', label: '3', subLabel: '#', flex: 1 },
    { code: 'Digit4', label: '4', subLabel: '$', flex: 1 },
    { code: 'Digit5', label: '5', subLabel: '%', flex: 1 },
    { code: 'Digit6', label: '6', subLabel: '^', flex: 1 },
    { code: 'Digit7', label: '7', subLabel: '&', flex: 1 },
    { code: 'Digit8', label: '8', subLabel: '*', flex: 1 },
    { code: 'Digit9', label: '9', subLabel: '(', flex: 1 },
    { code: 'Digit0', label: '0', subLabel: ')', flex: 1 },
    { code: 'Minus', label: '-', subLabel: '_', flex: 1 },
    { code: 'Equal', label: '=', subLabel: '+', flex: 1 },
    { code: 'Backspace', label: '⌫ BACK', flex: 1.8 },
  ],
  // Hàng Tab / QWERTY
  [
    { code: 'Tab', label: 'TAB', flex: 1.5 },
    { code: 'KeyQ', label: 'Q', flex: 1 },
    { code: 'KeyW', label: 'W', flex: 1 },
    { code: 'KeyE', label: 'E', flex: 1 },
    { code: 'KeyR', label: 'R', flex: 1 },
    { code: 'KeyT', label: 'T', flex: 1 },
    { code: 'KeyY', label: 'Y', flex: 1 },
    { code: 'KeyU', label: 'U', flex: 1 },
    { code: 'KeyI', label: 'I', flex: 1 },
    { code: 'KeyO', label: 'O', flex: 1 },
    { code: 'KeyP', label: 'P', flex: 1 },
    { code: 'BracketLeft', label: '[', subLabel: '{', flex: 1 },
    { code: 'BracketRight', label: ']', subLabel: '}', flex: 1 },
    { code: 'Backslash', label: '\\', subLabel: '|', flex: 1.3 },
  ],
  // Hàng Caps / Home Row
  [
    { code: 'CapsLock', label: 'CAPS', flex: 1.7 },
    { code: 'KeyA', label: 'A', flex: 1 },
    { code: 'KeyS', label: 'S', flex: 1 },
    { code: 'KeyD', label: 'D', flex: 1 },
    { code: 'KeyF', label: 'F', flex: 1 },
    { code: 'KeyG', label: 'G', flex: 1 },
    { code: 'KeyH', label: 'H', flex: 1 },
    { code: 'KeyJ', label: 'J', flex: 1 },
    { code: 'KeyK', label: 'K', flex: 1 },
    { code: 'KeyL', label: 'L', flex: 1 },
    { code: 'Semicolon', label: ';', subLabel: ':', flex: 1 },
    { code: 'Quote', label: "'", subLabel: '"', flex: 1 },
    { code: 'Enter', label: '↵ ENTER', flex: 2.1 },
  ],
  // Hàng Shift
  [
    { code: 'ShiftLeft', label: '⇧ SHIFT', flex: 2.2 },
    { code: 'KeyZ', label: 'Z', flex: 1 },
    { code: 'KeyX', label: 'X', flex: 1 },
    { code: 'KeyC', label: 'C', flex: 1 },
    { code: 'KeyV', label: 'V', flex: 1 },
    { code: 'KeyB', label: 'B', flex: 1 },
    { code: 'KeyN', label: 'N', flex: 1 },
    { code: 'KeyM', label: 'M', flex: 1 },
    { code: 'Comma', label: ',', subLabel: '<', flex: 1 },
    { code: 'Period', label: '.', subLabel: '>', flex: 1 },
    { code: 'Slash', label: '/', subLabel: '?', flex: 1 },
    { code: 'ShiftRight', label: '⇧ SHIFT', flex: 1.6 },
    { code: 'ArrowUp', label: '▲', flex: 1 },
  ],
  // Hàng dưới cùng: Control, Win, Alt, Space, Arrows
  [
    { code: 'ControlLeft', label: 'CTRL', flex: 1.3 },
    { code: 'MetaLeft', label: 'WIN', flex: 1.2 },
    { code: 'AltLeft', label: 'ALT', flex: 1.2 },
    { code: 'Space', label: 'SPACE BAR', flex: 5.6 },
    { code: 'AltRight', label: 'ALT', flex: 1.2 },
    { code: 'ControlRight', label: 'CTRL', flex: 1.2 },
    { code: 'ArrowLeft', label: '◀', flex: 1 },
    { code: 'ArrowDown', label: '▼', flex: 1 },
    { code: 'ArrowRight', label: '▶', flex: 1 },
  ],
];

export function Keyboard2DVisualizer() {
  const [activeCodes, setActiveCodes] = useState<Set<string>>(new Set());
  const timerMap = useRef<Map<string, any>>(new Map());

  // Bật chế độ thu thập tín hiệu phím khi mở trang
  useEffect(() => {
    setCaptureMode('stream');

    const offKey = addListener('onKey', (event) => {
      const code = webCodeForKeyCode(event.keyCode);
      if (!code) return;

      setActiveCodes((prev) => {
        const next = new Set(prev);
        if (event.down) {
          next.add(code);
        } else {
          next.delete(code);
        }
        return next;
      });
    });

    return () => {
      offKey();
      setCaptureMode('ui');
    };
  }, []);

  // Mô phỏng bấm phím khi chạm vào màn hình (touch fallback)
  const handleTouchKey = (code: string) => {
    setActiveCodes((prev) => new Set(prev).add(code));
    if (timerMap.current.has(code)) clearTimeout(timerMap.current.get(code));
    const timer = setTimeout(() => {
      setActiveCodes((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }, 250);
    timerMap.current.set(code, timer);
  };

  return (
    <View style={styles.container}>
      {/* 2. MA TRẬN 2D BÀN PHÍM */}
      <View style={styles.keyboardFrame}>
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.keyboardRow}>
            {row.map((item) => {
              const active = activeCodes.has(item.code);
              return (
                <Press
                  key={item.code}
                  onPress={() => handleTouchKey(item.code)}
                  pressScale={0.97}
                  style={[
                    styles.keycap,
                    { flex: item.flex ?? 1 },
                    active && styles.keycapActive,
                  ]}
                >
                  {item.subLabel ? (
                    <T
                      size={7}
                      color={active ? 'rgba(255,255,255,0.85)' : '#6E8199'}
                      style={styles.keySubLabel}
                    >
                      {item.subLabel}
                    </T>
                  ) : null}
                  <T
                    size={item.label.length > 3 ? 8 : 10}
                    weight="bold"
                    color={active ? '#FFFFFF' : '#A4B5C8'}
                    numberOfLines={1}
                  >
                    {item.label}
                  </T>
                </Press>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0E14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D2736',
    overflow: 'hidden',
    padding: 10,
  },
  keyboardFrame: {
    backgroundColor: '#131A26',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#233044',
    gap: 4,
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: 3.5,
  },
  keycap: {
    height: 28,
    borderRadius: 5,
    backgroundColor: '#1C2637',
    borderWidth: 1,
    borderColor: '#2D3E57',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
    elevation: 2,
  },
  keycapActive: {
    backgroundColor: appleColors.blue,
    borderColor: '#FFFFFF',
    shadowColor: appleColors.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  keySubLabel: {
    position: 'absolute',
    top: 1.5,
    left: 3,
  },
});
