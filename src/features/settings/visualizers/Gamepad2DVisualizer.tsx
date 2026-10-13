// Trình trực quan hoá 2D tay cầm vật lý theo thời gian thực (Digital Twin Gamepad)
// Phản hồi tức thì khi người dùng bấm nút, gạt cần analog, bóp cò trên tay cầm ngoài.
// Hỗ trợ đổi bố cục linh hoạt: Xbox, PlayStation, Nintendo. Có chế độ chú thích (Callouts).

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { NativeGamepadState } from 'jetsona-input';

import { appleColors } from '@/features/settings/controls';
import { T } from '@/ui/Text';

export type ControllerLayoutKind = 'auto' | 'xbox' | 'playstation' | 'nintendo';

export type Gamepad2DVisualizerProps = {
  state: NativeGamepadState | null;
  layout?: ControllerLayoutKind;
  leftDeadzone?: number;
  rightDeadzone?: number;
  triggerDeadzone?: number;
  showCallouts?: boolean;
  onButtonPress?: (buttonName: string) => void;
};

// Mask bit cờ nút theo chuẩn Moonlight / XInput
const MASK_A = 0x1000;
const MASK_B = 0x2000;
const MASK_X = 0x4000;
const MASK_Y = 0x8000;
const MASK_LB = 0x0100;
const MASK_RB = 0x0200;
const MASK_BACK = 0x0020;
const MASK_START = 0x0010;
const MASK_L3 = 0x0040;
const MASK_R3 = 0x0080;
const MASK_UP = 0x0001;
const MASK_DOWN = 0x0002;
const MASK_LEFT = 0x0004;
const MASK_RIGHT = 0x0008;

export function Gamepad2DVisualizer({
  state,
  layout = 'xbox',
  leftDeadzone = 0.08,
  rightDeadzone = 0.08,
  triggerDeadzone = 0.05,
  showCallouts = true,
  onButtonPress,
}: Gamepad2DVisualizerProps) {
  const buttons = state?.buttons ?? 0;
  const lx = Math.max(-1, Math.min(1, state?.lx ?? 0));
  const ly = Math.max(-1, Math.min(1, state?.ly ?? 0));
  const rx = Math.max(-1, Math.min(1, state?.rx ?? 0));
  const ry = Math.max(-1, Math.min(1, state?.ry ?? 0));
  const lt = Math.max(0, Math.min(1, state?.lt ?? 0));
  const rt = Math.max(0, Math.min(1, state?.rt ?? 0));

  // Kiểm tra trạng thái từng nút
  const isA = (buttons & MASK_A) !== 0;
  const isB = (buttons & MASK_B) !== 0;
  const isX = (buttons & MASK_X) !== 0;
  const isY = (buttons & MASK_Y) !== 0;
  const isLB = (buttons & MASK_LB) !== 0;
  const isRB = (buttons & MASK_RB) !== 0;
  const isLT = lt > triggerDeadzone;
  const isRT = rt > triggerDeadzone;
  const isBack = (buttons & MASK_BACK) !== 0;
  const isStart = (buttons & MASK_START) !== 0;
  const isL3 = (buttons & MASK_L3) !== 0;
  const isR3 = (buttons & MASK_R3) !== 0;
  const isUp = (buttons & MASK_UP) !== 0;
  const isDown = (buttons & MASK_DOWN) !== 0;
  const isLeft = (buttons & MASK_LEFT) !== 0;
  const isRight = (buttons & MASK_RIGHT) !== 0;

  // Nhãn mặt nút theo bố cục
  const faceLabels = useMemo(() => {
    if (layout === 'playstation') {
      return { top: '△', bottom: '✕', left: '□', right: '○' };
    }
    if (layout === 'nintendo') {
      return { top: 'X', bottom: 'B', left: 'Y', right: 'A' };
    }
    return { top: 'Y', bottom: 'A', left: 'X', right: 'B' };
  }, [layout]);

  // Màu sắc theo bố cục
  const faceColors = useMemo(() => {
    if (layout === 'playstation') {
      return {
        top: '#30D158', // Triangle xanh lá
        bottom: '#0A84FF', // Cross xanh dương
        left: '#FF375F', // Square hồng
        right: '#FF453A', // Circle đỏ
      };
    }
    if (layout === 'nintendo') {
      return {
        top: '#E5E5EA',
        bottom: '#E5E5EA',
        left: '#E5E5EA',
        right: '#E5E5EA',
      };
    }
    // Xbox mặc định
    return {
      top: '#FFD60A', // Y vàng
      bottom: '#30D158', // A xanh lá
      left: '#0A84FF', // X xanh dương
      right: '#FF453A', // B đỏ
    };
  }, [layout]);

  // Độ dịch chuyển cần gạt (tối đa 15px)
  const maxStickTravel = 15;
  const lStickDx = lx * maxStickTravel;
  const lStickDy = ly * maxStickTravel;
  const rStickDx = rx * maxStickTravel;
  const rStickDy = ry * maxStickTravel;

  // Màu sắc nền & viền phong cách Console Blueprint tối tân
  const colorActive = appleColors.blue;
  const colorBorder = '#2A3649';
  const colorMuted = '#485870';
  const colorCalloutLine = 'rgba(100, 140, 180, 0.45)';
  const colorCalloutText = '#8FA2BC';

  return (
    <View style={styles.container}>
      {/* Sân khấu 2D SVG biểu diễn tay cầm thật */}
      <View style={styles.svgWrapper}>
        <Svg viewBox="0 0 540 370" style={styles.svg}>
          <Defs>
            {/* Gradient cho vỏ tay cầm */}
            <LinearGradient id="shellGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#1E2736" />
              <Stop offset="100%" stopColor="#11161F" />
            </LinearGradient>
            {/* Gradient cho cò LT */}
            <LinearGradient id="ltGrad" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor={colorActive} stopOpacity={0.85} />
              <Stop offset="100%" stopColor="#5AC8FA" stopOpacity={0.95} />
            </LinearGradient>
            {/* Gradient cho cò RT */}
            <LinearGradient id="rtGrad" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor={colorActive} stopOpacity={0.85} />
              <Stop offset="100%" stopColor="#5AC8FA" stopOpacity={0.95} />
            </LinearGradient>
          </Defs>

          {/* 1. CÒ TRÁI LT & CÒ PHẢI RT (Triggers) */}
          {/* LT trigger */}
          <G onPress={() => onButtonPress?.('LT')}>
            {/* Nền cò LT */}
            <Path
              d="M 115 58 C 115 32, 130 18, 175 18 C 185 18, 190 28, 190 58 Z"
              fill="#0F141C"
              stroke={isLT ? colorActive : colorBorder}
              strokeWidth={isLT ? 2.5 : 1.5}
            />
            {/* Tiến trình bóp cò LT (0% đến 100%) */}
            {lt > 0.02 && (
              <Path
                d={`M 116 ${58 - lt * 38} C 116 32, 130 18, 175 18 C 185 18, 189 28, 189 ${58 - lt * 38} Z`}
                fill="url(#ltGrad)"
                opacity={0.85}
              />
            )}
            <SvgText
              x="152"
              y="44"
              fill={isLT ? '#FFFFFF' : colorMuted}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {`LT ${Math.round(lt * 100)}%`}
            </SvgText>
          </G>

          {/* RT trigger */}
          <G onPress={() => onButtonPress?.('RT')}>
            {/* Nền cò RT */}
            <Path
              d="M 350 58 C 350 28, 355 18, 365 18 C 410 18, 425 32, 425 58 Z"
              fill="#0F141C"
              stroke={isRT ? colorActive : colorBorder}
              strokeWidth={isRT ? 2.5 : 1.5}
            />
            {/* Tiến trình bóp cò RT */}
            {rt > 0.02 && (
              <Path
                d={`M 351 ${58 - rt * 38} C 351 28, 355 18, 365 18 C 410 18, 424 32, 424 ${58 - rt * 38} Z`}
                fill="url(#rtGrad)"
                opacity={0.85}
              />
            )}
            <SvgText
              x="388"
              y="44"
              fill={isRT ? '#FFFFFF' : colorMuted}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {`RT ${Math.round(rt * 100)}%`}
            </SvgText>
          </G>

          {/* 2. GÙ NÚT VAI LB & RB (Bumpers) */}
          {/* LB */}
          <G onPress={() => onButtonPress?.('LB')}>
            <Path
              d="M 100 85 C 100 62, 120 54, 202 54 C 205 68, 205 76, 200 85 Z"
              fill={isLB ? colorActive : '#17202C'}
              stroke={isLB ? '#FFFFFF' : colorBorder}
              strokeWidth={isLB ? 2 : 1.2}
            />
            <SvgText
              x="150"
              y="74"
              fill={isLB ? '#FFFFFF' : '#8E9EB5'}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              LB
            </SvgText>
          </G>

          {/* RB */}
          <G onPress={() => onButtonPress?.('RB')}>
            <Path
              d="M 340 85 C 335 76, 335 68, 338 54 C 420 54, 440 62, 440 85 Z"
              fill={isRB ? colorActive : '#17202C'}
              stroke={isRB ? '#FFFFFF' : colorBorder}
              strokeWidth={isRB ? 2 : 1.2}
            />
            <SvgText
              x="390"
              y="74"
              fill={isRB ? '#FFFFFF' : '#8E9EB5'}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              RB
            </SvgText>
          </G>

          {/* 3. THÂN TAY CẦM CHÍNH (Ergonomic Gamepad Body) */}
          <Path
            d={`
              M 205 60
              C 230 56, 310 56, 335 60
              C 415 60, 448 78, 470 125
              C 490 170, 498 250, 482 315
              C 475 342, 448 350, 425 330
              C 390 300, 360 250, 345 230
              C 305 255, 235 255, 195 230
              C 180 250, 150 300, 115 330
              C 92 350, 65 342, 58 315
              C 42 250, 50 170, 70 125
              C 92 78, 125 60, 205 60
              Z
            `}
            fill="url(#shellGrad)"
            stroke={colorBorder}
            strokeWidth="2"
          />

          {/* Đường vân grip cao su hai bên tay cầm */}
          <Path
            d="M 75 140 C 58 200, 64 270, 85 315"
            stroke={colorBorder}
            strokeWidth="2"
            fill="none"
            strokeDasharray="4,4"
            opacity={0.4}
          />
          <Path
            d="M 465 140 C 482 200, 476 270, 455 315"
            stroke={colorBorder}
            strokeWidth="2"
            fill="none"
            strokeDasharray="4,4"
            opacity={0.4}
          />

          {/* Đường nhấn cong ở giữa thân dưới */}
          <Path
            d="M 210 240 C 240 255, 300 255, 330 240"
            stroke="#263345"
            strokeWidth="2"
            fill="none"
          />

          {/* 4. CẦN GẠT TRÁI (Left Thumbstick / L3) */}
          <G onPress={() => onButtonPress?.('L3')}>
            {/* Đế hốc cần gạt */}
            <Circle cx="160" cy="145" r="38" fill="#0C1017" stroke={colorBorder} strokeWidth="2" />
            {/* Vòng ngưỡng vùng chết (Deadzone indicator) */}
            <Circle
              cx="160"
              cy="145"
              r={38 * leftDeadzone}
              fill="none"
              stroke="rgba(255, 150, 0, 0.45)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            {/* Trục chữ thập định hướng */}
            <Path d="M 160 115 L 160 175 M 130 145 L 190 145" stroke="#1A2433" strokeWidth="1" />
            {/* Mũ cần gạt di chuyển theo thời gian thực */}
            <Circle
              cx={160 + lStickDx}
              cy={145 + lStickDy}
              r="24"
              fill={isL3 ? colorActive : '#222C3D'}
              stroke={isL3 ? '#FFFFFF' : '#3D4F6B'}
              strokeWidth={isL3 ? 2.5 : 2}
            />
            {/* Tâm lõm ngón tay cái */}
            <Circle
              cx={160 + lStickDx}
              cy={145 + lStickDy}
              r="17"
              fill={isL3 ? '#0062CC' : '#171E2B'}
              stroke="#2E3C52"
              strokeWidth="1.5"
            />
            {/* Chấm tâm */}
            <Circle
              cx={160 + lStickDx}
              cy={145 + lStickDy}
              r="4"
              fill={isL3 ? '#FFFFFF' : colorActive}
            />
            <SvgText
              x={160 + lStickDx}
              y={148 + lStickDy + 11}
              fill={isL3 ? '#FFFFFF' : '#738BAE'}
              fontSize="7.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              L3
            </SvgText>
          </G>

          {/* 5. CỤM PHÍM ĐIỀU HƯỚNG D-PAD */}
          <G>
            {/* Đế cụm thập hướng */}
            <Circle cx="210" cy="225" r="35" fill="#0D121A" stroke={colorBorder} strokeWidth="1.5" />

            {/* D-Pad Up */}
            <G onPress={() => onButtonPress?.('D-Pad Up')}>
              <Rect
                x="200"
                y="195"
                width="20"
                height="20"
                rx="3"
                fill={isUp ? colorActive : '#1E2838'}
                stroke={isUp ? '#FFFFFF' : '#33445C'}
                strokeWidth={isUp ? 2 : 1}
              />
              <SvgText
                x="210"
                y="209"
                fill={isUp ? '#FFFFFF' : '#A0B2C6'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                ▲
              </SvgText>
            </G>

            {/* D-Pad Down */}
            <G onPress={() => onButtonPress?.('D-Pad Down')}>
              <Rect
                x="200"
                y="235"
                width="20"
                height="20"
                rx="3"
                fill={isDown ? colorActive : '#1E2838'}
                stroke={isDown ? '#FFFFFF' : '#33445C'}
                strokeWidth={isDown ? 2 : 1}
              />
              <SvgText
                x="210"
                y="249"
                fill={isDown ? '#FFFFFF' : '#A0B2C6'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                ▼
              </SvgText>
            </G>

            {/* D-Pad Left */}
            <G onPress={() => onButtonPress?.('D-Pad Left')}>
              <Rect
                x="180"
                y="215"
                width="20"
                height="20"
                rx="3"
                fill={isLeft ? colorActive : '#1E2838'}
                stroke={isLeft ? '#FFFFFF' : '#33445C'}
                strokeWidth={isLeft ? 2 : 1}
              />
              <SvgText
                x="190"
                y="229"
                fill={isLeft ? '#FFFFFF' : '#A0B2C6'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                ◀
              </SvgText>
            </G>

            {/* D-Pad Right */}
            <G onPress={() => onButtonPress?.('D-Pad Right')}>
              <Rect
                x="220"
                y="215"
                width="20"
                height="20"
                rx="3"
                fill={isRight ? colorActive : '#1E2838'}
                stroke={isRight ? '#FFFFFF' : '#33445C'}
                strokeWidth={isRight ? 2 : 1}
              />
              <SvgText
                x="230"
                y="229"
                fill={isRight ? '#FFFFFF' : '#A0B2C6'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                ▶
              </SvgText>
            </G>

            {/* Tâm rốn giữa D-Pad */}
            <Circle cx="210" cy="225" r="5" fill="#141B26" stroke="#25344A" strokeWidth="1" />
          </G>

          {/* 6. CẦN GẠT PHẢI (Right Thumbstick / R3) */}
          <G onPress={() => onButtonPress?.('R3')}>
            {/* Đế hốc cần gạt */}
            <Circle cx="330" cy="225" r="38" fill="#0C1017" stroke={colorBorder} strokeWidth="2" />
            {/* Vòng ngưỡng vùng chết (Deadzone indicator) */}
            <Circle
              cx="330"
              cy="225"
              r={38 * rightDeadzone}
              fill="none"
              stroke="rgba(255, 150, 0, 0.45)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            {/* Trục chữ thập */}
            <Path d="M 330 195 L 330 255 M 300 225 L 360 225" stroke="#1A2433" strokeWidth="1" />
            {/* Mũ cần gạt di chuyển theo thời gian thực */}
            <Circle
              cx={330 + rStickDx}
              cy={225 + rStickDy}
              r="24"
              fill={isR3 ? colorActive : '#222C3D'}
              stroke={isR3 ? '#FFFFFF' : '#3D4F6B'}
              strokeWidth={isR3 ? 2.5 : 2}
            />
            {/* Lõm tâm */}
            <Circle
              cx={330 + rStickDx}
              cy={225 + rStickDy}
              r="17"
              fill={isR3 ? '#0062CC' : '#171E2B'}
              stroke="#2E3C52"
              strokeWidth="1.5"
            />
            {/* Chấm tâm */}
            <Circle
              cx={330 + rStickDx}
              cy={225 + rStickDy}
              r="4"
              fill={isR3 ? '#FFFFFF' : colorActive}
            />
            <SvgText
              x={330 + rStickDx}
              y={228 + rStickDy + 11}
              fill={isR3 ? '#FFFFFF' : '#738BAE'}
              fontSize="7.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              R3
            </SvgText>
          </G>

          {/* 7. BỐN NÚT MẶT CHÍNH (Face Buttons: A, B, X, Y) */}
          <G>
            {/* Nền lõm hình kim cương */}
            <Circle cx="380" cy="145" r="42" fill="#0D121B" stroke={colorBorder} strokeWidth="1.5" />

            {/* NÚT Y (Trên) */}
            <G onPress={() => onButtonPress?.('Y')}>
              <Circle
                cx="380"
                cy="114"
                r="13.5"
                fill={isY ? faceColors.top : '#1A2330'}
                stroke={isY ? '#FFFFFF' : '#33445C'}
                strokeWidth={isY ? 2.5 : 1.2}
              />
              <SvgText
                x="380"
                y="119"
                fill={isY ? '#000000' : faceColors.top}
                fontSize="12.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                {faceLabels.top}
              </SvgText>
            </G>

            {/* NÚT A (Dưới) */}
            <G onPress={() => onButtonPress?.('A')}>
              <Circle
                cx="380"
                cy="176"
                r="13.5"
                fill={isA ? faceColors.bottom : '#1A2330'}
                stroke={isA ? '#FFFFFF' : '#33445C'}
                strokeWidth={isA ? 2.5 : 1.2}
              />
              <SvgText
                x="380"
                y="181"
                fill={isA ? '#000000' : faceColors.bottom}
                fontSize="12.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                {faceLabels.bottom}
              </SvgText>
            </G>

            {/* NÚT X (Trái) */}
            <G onPress={() => onButtonPress?.('X')}>
              <Circle
                cx="349"
                cy="145"
                r="13.5"
                fill={isX ? faceColors.left : '#1A2330'}
                stroke={isX ? '#FFFFFF' : '#33445C'}
                strokeWidth={isX ? 2.5 : 1.2}
              />
              <SvgText
                x="349"
                y="150"
                fill={isX ? '#000000' : faceColors.left}
                fontSize="12.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                {faceLabels.left}
              </SvgText>
            </G>

            {/* NÚT B (Phải) */}
            <G onPress={() => onButtonPress?.('B')}>
              <Circle
                cx="411"
                cy="145"
                r="13.5"
                fill={isB ? faceColors.right : '#1A2330'}
                stroke={isB ? '#FFFFFF' : '#33445C'}
                strokeWidth={isB ? 2.5 : 1.2}
              />
              <SvgText
                x="411"
                y="150"
                fill={isB ? '#000000' : faceColors.right}
                fontSize="12.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                {faceLabels.right}
              </SvgText>
            </G>
          </G>

          {/* 8. NÚT ĐIỀU KHIỂN TRUNG TÂM (Guide, Back, Start) */}
          {/* NÚT GUIDE / HOME Ở GIỮA */}
          <G onPress={() => onButtonPress?.('Guide')}>
            <Circle
              cx="270"
              cy="115"
              r="17"
              fill="#101721"
              stroke={colorBorder}
              strokeWidth="2"
            />
            <Circle
              cx="270"
              cy="115"
              r="13"
              fill="#182333"
              stroke="#344863"
              strokeWidth="1.2"
            />
            {/* Logo tay cầm / Xbox ở giữa */}
            <Path
              d="M 264 110 C 266 114, 274 114, 276 110 M 262 119 C 267 114, 273 114, 278 119"
              stroke={colorActive}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </G>

          {/* NÚT BACK / VIEW / SELECT */}
          <G onPress={() => onButtonPress?.('Back')}>
            <Rect
              x="226"
              y="136"
              width="22"
              height="14"
              rx="4"
              fill={isBack ? colorActive : '#1B2433'}
              stroke={isBack ? '#FFFFFF' : '#344863'}
              strokeWidth={isBack ? 2 : 1}
            />
            <SvgText
              x="237"
              y="147"
              fill={isBack ? '#FFFFFF' : '#8E9EB5'}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              ⧉
            </SvgText>
          </G>

          {/* NÚT START / MENU */}
          <G onPress={() => onButtonPress?.('Start')}>
            <Rect
              x="292"
              y="136"
              width="22"
              height="14"
              rx="4"
              fill={isStart ? colorActive : '#1B2433'}
              stroke={isStart ? '#FFFFFF' : '#344863'}
              strokeWidth={isStart ? 2 : 1}
            />
            <SvgText
              x="303"
              y="147"
              fill={isStart ? '#FFFFFF' : '#8E9EB5'}
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              ☰
            </SvgText>
          </G>

          {/* 9. CHÚ THÍCH DẠNG CALLOUT CHỈ VÀO THIẾT BỊ (THEO HÌNH MẪU ẢNH 2) */}
          {showCallouts && (
            <G opacity={0.92}>
              {/* Callout Cần trái */}
              <Path d="M 60 145 L 122 145" stroke={colorCalloutLine} strokeWidth="1" />
              <Circle cx="122" cy="145" r="2.5" fill={colorCalloutText} />
              <SvgText x="55" y="148" fill={colorCalloutText} fontSize="9" textAnchor="end">
                Cần trái / L3
              </SvgText>

              {/* Callout D-Pad */}
              <Path d="M 75 225 L 175 225" stroke={colorCalloutLine} strokeWidth="1" />
              <Circle cx="175" cy="225" r="2.5" fill={colorCalloutText} />
              <SvgText x="70" y="228" fill={colorCalloutText} fontSize="9" textAnchor="end">
                D-Pad
              </SvgText>

              {/* Callout Cò trái LT */}
              <Path d="M 85 30 L 120 30 L 135 40" stroke={colorCalloutLine} strokeWidth="1" fill="none" />
              <Circle cx="135" cy="40" r="2.5" fill={colorCalloutText} />
              <SvgText x="80" y="33" fill={colorCalloutText} fontSize="9" textAnchor="end">
                Cò trái (LT)
              </SvgText>

              {/* Callout Cò phải RT */}
              <Path d="M 455 30 L 420 30 L 405 40" stroke={colorCalloutLine} strokeWidth="1" fill="none" />
              <Circle cx="405" cy="40" r="2.5" fill={colorCalloutText} />
              <SvgText x="460" y="33" fill={colorCalloutText} fontSize="9" textAnchor="start">
                Cò phải (RT)
              </SvgText>

              {/* Callout Cụm nút A/B/X/Y */}
              <Path d="M 480 145 L 425 145" stroke={colorCalloutLine} strokeWidth="1" />
              <Circle cx="425" cy="145" r="2.5" fill={colorCalloutText} />
              <SvgText x="485" y="148" fill={colorCalloutText} fontSize="9" textAnchor="start">
                Nút hành động
              </SvgText>

              {/* Callout Cần phải */}
              <Path d="M 465 225 L 368 225" stroke={colorCalloutLine} strokeWidth="1" />
              <Circle cx="368" cy="225" r="2.5" fill={colorCalloutText} />
              <SvgText x="470" y="228" fill={colorCalloutText} fontSize="9" textAnchor="start">
                Cần phải / R3
              </SvgText>
            </G>
          )}
        </Svg>
      </View>

      {/* THANH THỐNG SỐ TỨC THỜI DƯỚI TAY CẦM */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <T size={9.5} color="#8E9EB5">CẦN TRÁI</T>
          <T size={11} weight="semibold" color="#FFFFFF" tabular>
            {`X: ${lx.toFixed(2)}  Y: ${ly.toFixed(2)}`}
          </T>
        </View>

        <View style={styles.metricItem}>
          <T size={9.5} color="#8E9EB5">CÒ TRÁI (LT)</T>
          <T size={11} weight="semibold" color={isLT ? colorActive : '#FFFFFF'} tabular>
            {`${Math.round(lt * 100)}%`}
          </T>
        </View>

        <View style={styles.metricItem}>
          <T size={9.5} color="#8E9EB5">CÒ PHẢI (RT)</T>
          <T size={11} weight="semibold" color={isRT ? colorActive : '#FFFFFF'} tabular>
            {`${Math.round(rt * 100)}%`}
          </T>
        </View>

        <View style={styles.metricItem}>
          <T size={9.5} color="#8E9EB5">CẦN PHẢI</T>
          <T size={11} weight="semibold" color="#FFFFFF" tabular>
            {`X: ${rx.toFixed(2)}  Y: ${ry.toFixed(2)}`}
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  svgWrapper: {
    width: '100%',
    aspectRatio: 540 / 370,
    maxWidth: 540,
    maxHeight: 330,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  metricsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A2433',
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
});
