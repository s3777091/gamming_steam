// Trình trực quan hoá 2D chuột quang học theo thời gian thực (Digital Twin Mouse)
// Bắt các sự kiện chuột từ module native: Chuột trái (LMB), Chuột phải (RMB), Chuột giữa (MMB),
// Nút hông Back/Forward, lăn chuột (Wheel Up/Down), và theo dõi chuyển động con trỏ (Movement Radar).

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  addListener,
  setCaptureMode,
  setPointerCapture,
  type NativeMouseEvent,
} from 'jetsona-input';

import { appleColors } from '@/features/settings/controls';
import { T } from '@/ui/Text';

export type Mouse2DVisualizerProps = {
  sensitivity?: number;
};

export function Mouse2DVisualizer({ sensitivity = 1.0 }: Mouse2DVisualizerProps) {
  const [activeButtons, setActiveButtons] = useState<Set<number>>(new Set());
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);

  // Vị trí con trỏ trong sân khấu kiểm tra chuyển động (Radar Pad)
  const [pointerPos, setPointerPos] = useState({ x: 90, y: 70 });
  const pointer = useRef({ x: 90, y: 70 });
  const frame = useRef<number | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = buttonTimers.current;
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Thu thập sự kiện chuột trực tiếp
  useEffect(() => {
    setCaptureMode('stream');

    const offMouse = addListener('onMouse', (event: NativeMouseEvent) => {
      if (event.type === 'button') {
        setActiveButtons((prev) => {
          if (prev.has(event.button) === event.down) return prev;
          const next = new Set(prev);
          if (event.down) {
            next.add(event.button);
          } else {
            next.delete(event.button);
          }
          return next;
        });
      } else if (event.type === 'wheel') {
        setScrollDirection(event.dy > 0 ? 'up' : 'down');
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => setScrollDirection(null), 300);
      } else if (event.type === 'move') {
        // Accumulate every hardware delta, but render only once per frame.
        // Fast mice can emit hundreds of events between two displayed frames.
        const x = Math.min(170, Math.max(10, pointer.current.x + event.dx * 0.8 * sensitivity));
        const y = Math.min(130, Math.max(10, pointer.current.y + event.dy * 0.8 * sensitivity));
        if (x === pointer.current.x && y === pointer.current.y) return;
        pointer.current = { x, y };
        if (frame.current !== null) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          setPointerPos(pointer.current);
        });
      }
    });

    return () => {
      offMouse();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      setCaptureMode('ui');
      setPointerCapture(false);
    };
  }, [sensitivity]);

  // Chạm thủ công để kiểm tra (Touch fallback)
  const handleTouchButton = (btn: number) => {
    setActiveButtons((prev) => new Set(prev).add(btn));
    if (buttonTimers.current.has(btn)) clearTimeout(buttonTimers.current.get(btn));
    const timer = setTimeout(() => {
      buttonTimers.current.delete(btn);
      setActiveButtons((prev) => {
        const next = new Set(prev);
        next.delete(btn);
        return next;
      });
    }, 200);
    buttonTimers.current.set(btn, timer);
  };

  const isLMB = activeButtons.has(1);
  const isRMB = activeButtons.has(2);
  const isMMB = activeButtons.has(3);
  const isSideBack = activeButtons.has(4);
  const isSideFwd = activeButtons.has(5);

  return (
    <View style={styles.container}>
      {/* 2. KHU VỰC TRỰC QUAN HOÁ: MÔ HÌNH CHUỘT 2D & SÂN KHẤU RADAR CON TRỎ */}
      <View style={styles.mainStage}>
        {/* MÔ HÌNH CHUỘT 2D SVG */}
        <View style={styles.mouseWrapper}>
          <Svg viewBox="0 0 240 320" style={styles.mouseSvg}>
            <Defs>
              <LinearGradient id="mouseBodyGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#1B2433" />
                <Stop offset="100%" stopColor="#0F151F" />
              </LinearGradient>
              <LinearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#007AFF" />
                <Stop offset="100%" stopColor="#0051B3" />
              </LinearGradient>
            </Defs>

            {/* Thân chuột chính (Palm Shell) */}
            <Path
              d={`
                M 80 30
                C 50 35, 35 70, 30 140
                C 25 210, 40 280, 80 300
                C 105 310, 135 310, 160 300
                C 200 280, 215 210, 210 140
                C 205 70, 190 35, 160 30
                Z
              `}
              fill="url(#mouseBodyGrad)"
              stroke="#2A384C"
              strokeWidth="2"
            />

            {/* Khe rãnh phân tách thân chuột */}
            <Path d="M 120 120 L 120 200" stroke="#253346" strokeWidth="1.5" />

            {/* CHUỘT TRÁI (LMB - Button 1) */}
            <G onPress={() => handleTouchButton(1)}>
              <Path
                d={`
                  M 112 32
                  L 80 34
                  C 54 38, 42 70, 38 120
                  L 112 120
                  Z
                `}
                fill={isLMB ? 'url(#activeGrad)' : '#192230'}
                stroke={isLMB ? '#FFFFFF' : '#33445C'}
                strokeWidth={isLMB ? 2 : 1.2}
              />
              <SvgText
                x="75"
                y="85"
                fill={isLMB ? '#FFFFFF' : '#8FA2BC'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                LMB
              </SvgText>
            </G>

            {/* CHUỘT PHẢI (RMB - Button 2) */}
            <G onPress={() => handleTouchButton(2)}>
              <Path
                d={`
                  M 128 32
                  L 160 34
                  C 186 38, 198 70, 202 120
                  L 128 120
                  Z
                `}
                fill={isRMB ? 'url(#activeGrad)' : '#192230'}
                stroke={isRMB ? '#FFFFFF' : '#33445C'}
                strokeWidth={isRMB ? 2 : 1.2}
              />
              <SvgText
                x="165"
                y="85"
                fill={isRMB ? '#FFFFFF' : '#8FA2BC'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                RMB
              </SvgText>
            </G>

            {/* CON LĂN CHUỘT / NÚT GIỮA (MMB - Button 3) */}
            <G onPress={() => handleTouchButton(3)}>
              {/* Rãnh chứa con lăn */}
              <Rect x="111" y="44" width="18" height="48" rx="9" fill="#0C1017" stroke="#223042" strokeWidth="1" />
              {/* Con lăn */}
              <Rect
                x="113"
                y="47"
                width="14"
                height="42"
                rx="7"
                fill={isMMB ? appleColors.blue : '#283547'}
                stroke={isMMB ? '#FFFFFF' : '#3B4D66'}
                strokeWidth={isMMB ? 2 : 1}
              />
              {/* Khía trên con lăn */}
              <Path
                d="M 115 57 L 125 57 M 115 67 L 125 67 M 115 77 L 125 77"
                stroke={scrollDirection ? '#FFFFFF' : '#17202B'}
                strokeWidth="1.5"
              />
            </G>

            {/* NÚT PHỤ BÊN HÔNG (Side Buttons 4 & 5) */}
            {/* Nút Forward (Button 5) */}
            <G onPress={() => handleTouchButton(5)}>
              <Path
                d="M 32 135 C 28 135, 24 140, 23 150 C 22 158, 25 163, 30 165 Z"
                fill={isSideFwd ? appleColors.blue : '#182230'}
                stroke={isSideFwd ? '#FFFFFF' : '#35475E'}
                strokeWidth={isSideFwd ? 1.8 : 1}
              />
              <SvgText x="16" y="153" fill={isSideFwd ? '#FFFFFF' : '#8FA2BC'} fontSize="7" fontWeight="bold">
                FWD
              </SvgText>
            </G>

            {/* Nút Back (Button 4) */}
            <G onPress={() => handleTouchButton(4)}>
              <Path
                d="M 29 170 C 25 172, 22 178, 23 188 C 24 195, 28 198, 33 198 Z"
                fill={isSideBack ? appleColors.blue : '#182230'}
                stroke={isSideBack ? '#FFFFFF' : '#35475E'}
                strokeWidth={isSideBack ? 1.8 : 1}
              />
              <SvgText x="16" y="188" fill={isSideBack ? '#FFFFFF' : '#8FA2BC'} fontSize="7" fontWeight="bold">
                BACK
              </SvgText>
            </G>

            {/* Nút chỉnh DPI ở giữa */}
            <Rect x="114" y="104" width="12" height="14" rx="3" fill="#1C2736" stroke="#2E3E54" strokeWidth="1" />
            <SvgText x="120" y="114" fill="#6A7D94" fontSize="6.5" fontWeight="bold" textAnchor="middle">
              DPI
            </SvgText>

            {/* Logo đèn trang trí phía dưới */}
            <Path
              d="M 120 220 L 126 232 L 120 244 L 114 232 Z"
              fill="none"
              stroke={appleColors.blue}
              strokeWidth="1.5"
              opacity={0.6}
            />
          </Svg>
        </View>

        {/* SÂN KHẤU RADAR KIỂM TRA ĐỘ MƯỢT VÀ CON TRỎ */}
        <View style={styles.radarBox}>
          <View style={styles.radarHeader}>
            <T size={10} weight="semibold" color="#8E9EB5">KHU VỰC THỬ CHUỘT (POINTER RADAR)</T>
          </View>

          <View style={styles.radarArea}>
            {/* Lưới toạ độ */}
            <View style={styles.gridLineH} />
            <View style={styles.gridLineV} />

            {/* Điểm con trỏ di chuyển theo thời gian thực */}
            <View
              style={[
                styles.pointerDot,
                {
                  left: pointerPos.x - 7,
                  top: pointerPos.y - 7,
                  backgroundColor: isLMB || isRMB ? '#FF3B30' : appleColors.blue,
                },
              ]}
            >
              <View style={styles.pointerRing} />
            </View>
          </View>

          <T size={9.5} color="#657891" style={{ textAlign: 'center' }}>
            Di chuột và bấm click để xem chuyển động mượt mà và độ trễ
          </T>
        </View>
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
    gap: 8,
  },
  mainStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  mouseWrapper: {
    width: 140,
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mouseSvg: {
    width: '100%',
    height: '100%',
  },
  radarBox: {
    flex: 1,
    maxWidth: 240,
    backgroundColor: '#111722',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#202C3E',
    padding: 8,
    gap: 6,
  },
  radarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  radarArea: {
    width: '100%',
    height: 120,
    backgroundColor: '#090D13',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1A2433',
    position: 'relative',
    overflow: 'hidden',
  },
  gridLineH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#16202E',
  },
  gridLineV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#16202E',
  },
  pointerDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointerRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
