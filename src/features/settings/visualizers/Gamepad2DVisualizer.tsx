// Trình trực quan hoá 3D Digital Twin tay cầm theo thời gian thực (Next-Gen 3D Gamepad Visualizer)
// Phản hồi tức thì khi bấm nút, gạt cần analog, bóp cò trên tay cầm thật.
// Thiết kế 3D đẳng cấp Console Pro với hiệu ứng chiều sâu, gradient đổ bóng, chất liệu cao su/kim loại,
// analog stick di chuyển theo thời gian thực với dynamic cast shadow, và cò LT/RT đo lực bóp chân thực.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { NativeGamepadState } from 'jetsona-input';
import { useTheme } from '@/theme';

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
  const { settings: appleColors, colors } = useTheme();
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

  // Dịch chuyển cò bóp LT / RT theo độ sâu (0..8px)
  const ltPullOffset = lt * 8;
  const rtPullOffset = rt * 8;

  // Màu sắc chủ đạo & điểm nhấn
  const colorActive = appleColors.blue ?? colors.primary;
  const colorActiveGlow = '#38BDF8';
  const colorCalloutLine = 'rgba(70, 130, 200, 0.42)';
  const colorCalloutText = '#93A4BA';

  return (
    <View style={styles.container}>
      {/* Sân khấu 3D Vector biểu diễn tay cầm thật */}
      <View style={styles.svgWrapper}>
        <Svg viewBox="0 0 540 370" style={styles.svg}>
          <Defs>
            {/* 1. Đèn sân khấu tỏa sáng dịu phía sau */}
            <RadialGradient id="stageBacklight" cx="50%" cy="48%" r="50%">
              <Stop offset="0%" stopColor="#142036" stopOpacity="0.45" />
              <Stop offset="65%" stopColor="#0B1019" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#080C14" stopOpacity="0" />
            </RadialGradient>

            {/* 2. Đổ bóng sàn vật lý (Floor Ambient Occlusion) */}
            <RadialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#000000" stopOpacity="0.85" />
              <Stop offset="60%" stopColor="#000000" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>

            {/* 3. Gradient vỏ thân máy chính (3D Chiseled Shell) */}
            <LinearGradient id="chassisGrad" x1="0.15" y1="0" x2="0.85" y2="1">
              <Stop offset="0%" stopColor="#283344" />
              <Stop offset="25%" stopColor="#1C2432" />
              <Stop offset="70%" stopColor="#121721" />
              <Stop offset="100%" stopColor="#0B0F15" />
            </LinearGradient>

            {/* Viền cạnh ánh sáng 3D (Rim highlight) */}
            <LinearGradient id="rimHighlightGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#546682" stopOpacity="0.65" />
              <Stop offset="40%" stopColor="#2F3C4F" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#121822" stopOpacity="0.1" />
            </LinearGradient>

            {/* 4. Cao su báng cầm vân nhám (Textured Rubber Grip) */}
            <LinearGradient id="gripGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#171F2C" />
              <Stop offset="50%" stopColor="#0F141D" />
              <Stop offset="100%" stopColor="#080B0F" />
            </LinearGradient>

            {/* 5. Tấm ốp bóng mặt trên (Piano-Black Top Fascia) */}
            <LinearGradient id="fasciaPlateGrad" x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0%" stopColor="#2C374A" />
              <Stop offset="45%" stopColor="#18202D" />
              <Stop offset="100%" stopColor="#0F131C" />
            </LinearGradient>

            {/* 6. Cò bóp 3D Triggers (LT & RT) */}
            <LinearGradient id="triggerGrad" x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0%" stopColor="#374457" />
              <Stop offset="30%" stopColor="#222B3A" />
              <Stop offset="100%" stopColor="#0F141D" />
            </LinearGradient>
            <LinearGradient id="triggerActiveGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#38BDF8" />
              <Stop offset="40%" stopColor="#0A84FF" />
              <Stop offset="100%" stopColor="#0056B3" />
            </LinearGradient>

            {/* 7. Gù vai Bumpers (LB & RB) */}
            <LinearGradient id="bumperGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#2D384A" />
              <Stop offset="60%" stopColor="#18202D" />
              <Stop offset="100%" stopColor="#10141C" />
            </LinearGradient>

            {/* 8. Hốc cần gạt lõm sâu (Conical Thumbstick Sockets) */}
            <RadialGradient id="stickWellGrad" cx="45%" cy="40%" r="55%">
              <Stop offset="0%" stopColor="#070A0F" />
              <Stop offset="75%" stopColor="#131A26" />
              <Stop offset="100%" stopColor="#283447" />
            </RadialGradient>

            {/* Mũ cần gạt Analog 3D với viền nhám và lòng lõm */}
            <RadialGradient id="stickCapGrad" cx="35%" cy="30%" r="65%">
              <Stop offset="0%" stopColor="#38475E" />
              <Stop offset="55%" stopColor="#202A3B" />
              <Stop offset="90%" stopColor="#141B26" />
              <Stop offset="100%" stopColor="#0C1017" />
            </RadialGradient>

            {/* Lòng lõm ngón tay cái */}
            <RadialGradient id="stickCupGrad" cx="45%" cy="45%" r="55%">
              <Stop offset="0%" stopColor="#0D121B" />
              <Stop offset="70%" stopColor="#17202E" />
              <Stop offset="100%" stopColor="#253246" />
            </RadialGradient>

            {/* 9. Đĩa kim loại phay xước cho D-Pad */}
            <RadialGradient id="dpadDishGrad" cx="42%" cy="38%" r="60%">
              <Stop offset="0%" stopColor="#0D121B" />
              <Stop offset="80%" stopColor="#192333" />
              <Stop offset="100%" stopColor="#2A384F" />
            </RadialGradient>

            {/* 10. Viên ngọc nút bấm 3D đa chiều (Gemstone Action Buttons) */}
            <RadialGradient id="btnGemBase" cx="35%" cy="30%" r="65%">
              <Stop offset="0%" stopColor="#35455E" />
              <Stop offset="60%" stopColor="#1C2433" />
              <Stop offset="100%" stopColor="#101520" />
            </RadialGradient>

            {/* Vòng kim loại Chrome Bezel */}
            <LinearGradient id="chromeRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#7E94B0" />
              <Stop offset="30%" stopColor="#435368" />
              <Stop offset="70%" stopColor="#1A222F" />
              <Stop offset="100%" stopColor="#4E607A" />
            </LinearGradient>

            {/* Quầng sáng Neon cho Guide / Nexus Button */}
            <RadialGradient id="nexusGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <Stop offset="45%" stopColor="#0284C7" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#0369A1" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* ============================================================== */}
          {/* LỚP 0: QUẦNG SÁNG & ĐỔ BÓNG NỀN 3D (3D Ambient Floor)          */}
          {/* ============================================================== */}
          <Rect x="40" y="20" width="460" height="330" fill="url(#stageBacklight)" rx="24" />

          {/* Bóng đổ tay cầm bên trái */}
          <Ellipse cx="118" cy="334" rx="58" ry="22" fill="url(#floorShadow)" />
          {/* Bóng đổ tay cầm bên phải */}
          <Ellipse cx="422" cy="334" rx="58" ry="22" fill="url(#floorShadow)" />
          {/* Bóng đổ gầm giữa */}
          <Ellipse cx="270" cy="275" rx="145" ry="34" fill="url(#floorShadow)" />

          {/* ============================================================== */}
          {/* LỚP 1: CÒ BÓP TRÊN 3D (LT & RT Triggers - Có đo lực bóp analog) */}
          {/* ============================================================== */}
          {/* Cò trái LT */}
          <G
            onPress={() => onButtonPress?.('LT')}
            transform={`translate(0, ${ltPullOffset})`}
          >
            {/* Lưỡi cò LT 3D */}
            <Path
              d="M 112 62 C 112 28, 126 12, 168 12 C 182 12, 192 22, 192 62 Z"
              fill={isLT ? 'url(#triggerActiveGrad)' : 'url(#triggerGrad)'}
              stroke={isLT ? '#FFFFFF' : '#334257'}
              strokeWidth={isLT ? 2 : 1.2}
            />
            {/* Vệt vát sáng cạnh trên cò */}
            <Path
              d="M 124 22 C 144 16, 172 16, 184 24"
              stroke={isLT ? '#E0F2FE' : '#5E7494'}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity={0.8}
            />
            {/* Thanh đo độ sâu analog (LT travel gauge) */}
            <Rect
              x="136"
              y="48"
              width="32"
              height="3"
              rx="1.5"
              fill="rgba(255, 255, 255, 0.2)"
            />
            <Rect
              x="136"
              y="48"
              width={32 * lt}
              height="3"
              rx="1.5"
              fill={isLT ? '#FFFFFF' : colorActive}
            />
            <SvgText
              x="152"
              y="38"
              fill={isLT ? '#FFFFFF' : '#8FA2BC'}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              LT
            </SvgText>
          </G>

          {/* Cò phải RT */}
          <G
            onPress={() => onButtonPress?.('RT')}
            transform={`translate(0, ${rtPullOffset})`}
          >
            {/* Lưỡi cò RT 3D */}
            <Path
              d="M 348 62 C 348 22, 358 12, 372 12 C 414 12, 428 28, 428 62 Z"
              fill={isRT ? 'url(#triggerActiveGrad)' : 'url(#triggerGrad)'}
              stroke={isRT ? '#FFFFFF' : '#334257'}
              strokeWidth={isRT ? 2 : 1.2}
            />
            {/* Vệt vát sáng cạnh trên cò */}
            <Path
              d="M 356 24 C 368 16, 396 16, 416 22"
              stroke={isRT ? '#E0F2FE' : '#5E7494'}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity={0.8}
            />
            {/* Thanh đo độ sâu analog (RT travel gauge) */}
            <Rect
              x="372"
              y="48"
              width="32"
              height="3"
              rx="1.5"
              fill="rgba(255, 255, 255, 0.2)"
            />
            <Rect
              x="372"
              y="48"
              width={32 * rt}
              height="3"
              rx="1.5"
              fill={isRT ? '#FFFFFF' : colorActive}
            />
            <SvgText
              x="388"
              y="38"
              fill={isRT ? '#FFFFFF' : '#8FA2BC'}
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              RT
            </SvgText>
          </G>

          {/* ============================================================== */}
          {/* LỚP 2: GÙ NÚT VAI BUMPERS (LB & RB) CÔNG THÁI HỌC               */}
          {/* ============================================================== */}
          {/* LB Bumper */}
          <G onPress={() => onButtonPress?.('LB')}>
            <Path
              d="M 98 86 C 96 66, 114 54, 196 54 C 201 64, 201 75, 198 86 Z"
              fill={isLB ? colorActive : 'url(#bumperGrad)'}
              stroke={isLB ? '#FFFFFF' : '#33445C'}
              strokeWidth={isLB ? 2 : 1.2}
            />
            {/* Mép phản chiếu kim loại mặt trước LB */}
            <Path
              d="M 106 68 C 128 58, 172 58, 192 64"
              stroke={isLB ? '#BAE6FD' : 'rgba(255, 255, 255, 0.22)'}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
            <SvgText
              x="150"
              y="74"
              fill={isLB ? '#FFFFFF' : '#94A3B8'}
              fontSize="10.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              LB
            </SvgText>
          </G>

          {/* RB Bumper */}
          <G onPress={() => onButtonPress?.('RB')}>
            <Path
              d="M 342 86 C 339 75, 339 64, 344 54 C 426 54, 444 66, 442 86 Z"
              fill={isRB ? colorActive : 'url(#bumperGrad)'}
              stroke={isRB ? '#FFFFFF' : '#33445C'}
              strokeWidth={isRB ? 2 : 1.2}
            />
            {/* Mép phản chiếu kim loại mặt trước RB */}
            <Path
              d="M 348 64 C 368 58, 412 58, 434 68"
              stroke={isRB ? '#BAE6FD' : 'rgba(255, 255, 255, 0.22)'}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
            <SvgText
              x="390"
              y="74"
              fill={isRB ? '#FFFFFF' : '#94A3B8'}
              fontSize="10.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              RB
            </SvgText>
          </G>

          {/* ============================================================== */}
          {/* LỚP 3: THÂN VỎ TAY CẦM CHÍNH 3D (Next-Gen Ergonomic Chassis)   */}
          {/* ============================================================== */}
          {/* Viền nổi khối ngoài cùng */}
          <Path
            d={`
              M 200 64
              C 230 60, 310 60, 340 64
              C 418 64, 452 82, 474 130
              C 496 178, 502 255, 484 318
              C 476 345, 446 352, 424 330
              C 388 296, 356 244, 340 226
              C 300 250, 240 250, 200 226
              C 184 244, 152 296, 116 330
              C 94 352, 64 345, 56 318
              C 38 255, 44 178, 66 130
              C 88 82, 122 64, 200 64
              Z
            `}
            fill="url(#chassisGrad)"
            stroke="url(#rimHighlightGrad)"
            strokeWidth="2"
          />

          {/* Báng cầm tay trái bọc đệm cao su (Left Grip Horn) */}
          <Path
            d="M 68 132 C 46 180, 40 258, 58 316 C 66 340, 92 346, 114 326 C 100 292, 88 238, 86 180 C 86 160, 78 142, 68 132 Z"
            fill="url(#gripGrad)"
            opacity={0.88}
          />
          {/* Vân nhám công nghệ cao chống trượt bên trái */}
          <Path
            d="M 62 180 C 58 220, 62 265, 78 305"
            stroke="#263447"
            strokeWidth="3"
            strokeDasharray="2,5"
            fill="none"
          />
          <Path
            d="M 70 170 C 66 210, 70 255, 88 295"
            stroke="#1E2A3B"
            strokeWidth="2.5"
            strokeDasharray="2,5"
            fill="none"
          />

          {/* Báng cầm tay phải bọc đệm cao su (Right Grip Horn) */}
          <Path
            d="M 472 132 C 494 180, 500 258, 482 316 C 474 340, 448 346, 426 326 C 440 292, 452 238, 454 180 C 454 160, 462 142, 472 132 Z"
            fill="url(#gripGrad)"
            opacity={0.88}
          />
          {/* Vân nhám công nghệ cao chống trượt bên phải */}
          <Path
            d="M 478 180 C 482 220, 478 265, 462 305"
            stroke="#263447"
            strokeWidth="3"
            strokeDasharray="2,5"
            fill="none"
          />
          <Path
            d="M 470 170 C 474 210, 470 255, 452 295"
            stroke="#1E2A3B"
            strokeWidth="2.5"
            strokeDasharray="2,5"
            fill="none"
          />

          {/* Tấm ốp bóng mặt trên bao quanh khu vực Nexus (Top Fascia Plate) */}
          <Path
            d={`
              M 200 64
              C 235 60, 305 60, 340 64
              C 342 85, 330 115, 312 135
              C 290 148, 250 148, 228 135
              C 210 115, 198 85, 200 64
              Z
            `}
            fill="url(#fasciaPlateGrad)"
            stroke="#222C3A"
            strokeWidth="1.2"
          />

          {/* Đường vát cong trung tâm tạo khối cơ bắp 3D */}
          <Path
            d="M 204 228 C 238 250, 302 250, 336 228"
            stroke="#1C2635"
            strokeWidth="2.5"
            fill="none"
          />

          {/* ============================================================== */}
          {/* LỚP 4: CẦN GẠT ANALOG TRÁI 3D (Left Stick / L3)               */}
          {/* ============================================================== */}
          <G onPress={() => onButtonPress?.('L3')}>
            {/* Hốc cầu lõm sâu trong vỏ (Spherical Socket Well) */}
            <Circle cx="160" cy="145" r="39" fill="url(#stickWellGrad)" stroke="url(#chromeRing)" strokeWidth="2.5" />
            <Circle cx="160" cy="145" r="37.5" fill="none" stroke="#05080C" strokeWidth="1.5" />

            {/* Vòng ngưỡng vùng chết (Deadzone boundary) */}
            <Circle
              cx="160"
              cy="145"
              r={39 * leftDeadzone}
              fill="none"
              stroke="rgba(245, 158, 11, 0.45)"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />

            {/* Đổ bóng 3D của trụ cần gạt di chuyển theo chiều ngược lại */}
            <Ellipse
              cx={160 - lStickDx * 0.3}
              cy={147 - lStickDy * 0.3}
              rx="24"
              ry="21"
              fill="#000000"
              opacity={0.65}
            />

            {/* Mũ cần gạt (Thumbstick Cap) di chuyển theo thời gian thực */}
            <G transform={`translate(${lStickDx}, ${lStickDy}) scale(${isL3 ? 0.94 : 1})`} origin="160, 145">
              {/* Vành cao su ngoài (Beveled Outer Grip Ring) */}
              <Circle
                cx="160"
                cy="145"
                r="24"
                fill={isL3 ? colorActive : 'url(#stickCapGrad)'}
                stroke={isL3 ? '#FFFFFF' : '#3C4B61'}
                strokeWidth={isL3 ? 2.5 : 2}
              />
              {/* Vòng gai nhám micro-knurling trên vành */}
              <Circle
                cx="160"
                cy="145"
                r="21.5"
                fill="none"
                stroke={isL3 ? '#93C5FD' : '#2C384B'}
                strokeWidth="1.5"
                strokeDasharray="2,3"
              />

              {/* 4 rãnh định hướng bám tay (Grip notches) */}
              <Rect x="158.5" y="122.5" width="3" height="3" rx="1" fill="#4B5E78" />
              <Rect x="158.5" y="164.5" width="3" height="3" rx="1" fill="#4B5E78" />
              <Rect x="137.5" y="143.5" width="3" height="3" rx="1" fill="#4B5E78" />
              <Rect x="179.5" y="143.5" width="3" height="3" rx="1" fill="#4B5E78" />

              {/* Lòng bát lõm ngón tay cái (Concave thumb cup) */}
              <Circle
                cx="160"
                cy="145"
                r="16.5"
                fill={isL3 ? '#005BBB' : 'url(#stickCupGrad)'}
                stroke="#1B2433"
                strokeWidth="1.5"
              />

              {/* Vệt sáng cong vát 3D (Specular crescent) */}
              <Path
                d="M 149 139 C 153 133, 167 133, 171 139"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />

              {/* Chấm tâm & Nhãn L3 */}
              <Circle cx="160" cy="144" r="3.5" fill={isL3 ? '#FFFFFF' : colorActive} />
              <SvgText
                x="160"
                y="157"
                fill={isL3 ? '#FFFFFF' : '#889BB5'}
                fontSize="7.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                L3
              </SvgText>
            </G>
          </G>

          {/* ============================================================== */}
          {/* LỚP 5: CỤM PHÍM ĐIỀU HƯỚNG D-PAD 3D NGUYÊN KHỐI                */}
          {/* ============================================================== */}
          <G>
            {/* Đĩa kim loại phay xước âm bên dưới */}
            <Circle cx="210" cy="225" r="36" fill="url(#dpadDishGrad)" stroke="url(#chromeRing)" strokeWidth="2" />
            <Circle cx="210" cy="225" r="34.5" fill="none" stroke="#080C12" strokeWidth="1.5" />

            {/* D-Pad Up */}
            <G onPress={() => onButtonPress?.('D-Pad Up')}>
              <Path
                d="M 200 220 L 200 196 C 200 193, 203 191, 206 191 L 214 191 C 217 191, 220 193, 220 196 L 220 220 Z"
                fill={isUp ? colorActive : '#202A38'}
                stroke={isUp ? '#FFFFFF' : '#33445C'}
                strokeWidth={isUp ? 2 : 1.2}
              />
              {/* Mũi tên Up chạm khắc */}
              <Path
                d="M 210 197 L 205 204 L 215 204 Z"
                fill={isUp ? '#FFFFFF' : '#8EA0B5'}
              />
            </G>

            {/* D-Pad Down */}
            <G onPress={() => onButtonPress?.('D-Pad Down')}>
              <Path
                d="M 200 230 L 200 254 C 200 257, 203 259, 206 259 L 214 259 C 217 259, 220 257, 220 254 L 220 230 Z"
                fill={isDown ? colorActive : '#202A38'}
                stroke={isDown ? '#FFFFFF' : '#33445C'}
                strokeWidth={isDown ? 2 : 1.2}
              />
              {/* Mũi tên Down chạm khắc */}
              <Path
                d="M 210 253 L 205 246 L 215 246 Z"
                fill={isDown ? '#FFFFFF' : '#8EA0B5'}
              />
            </G>

            {/* D-Pad Left */}
            <G onPress={() => onButtonPress?.('D-Pad Left')}>
              <Path
                d="M 205 215 L 181 215 C 178 215, 176 218, 176 221 L 176 229 C 176 232, 178 235, 181 235 L 205 235 Z"
                fill={isLeft ? colorActive : '#202A38'}
                stroke={isLeft ? '#FFFFFF' : '#33445C'}
                strokeWidth={isLeft ? 2 : 1.2}
              />
              {/* Mũi tên Left chạm khắc */}
              <Path
                d="M 182 225 L 189 220 L 189 230 Z"
                fill={isLeft ? '#FFFFFF' : '#8EA0B5'}
              />
            </G>

            {/* D-Pad Right */}
            <G onPress={() => onButtonPress?.('D-Pad Right')}>
              <Path
                d="M 215 215 L 239 215 C 242 215, 244 218, 244 221 L 244 229 C 244 232, 242 235, 239 235 L 215 235 Z"
                fill={isRight ? colorActive : '#202A38'}
                stroke={isRight ? '#FFFFFF' : '#33445C'}
                strokeWidth={isRight ? 2 : 1.2}
              />
              {/* Mũi tên Right chạm khắc */}
              <Path
                d="M 238 225 L 231 220 L 231 230 Z"
                fill={isRight ? '#FFFFFF' : '#8EA0B5'}
              />
            </G>

            {/* Tâm pivot lõm chữ thập D-Pad */}
            <Circle cx="210" cy="225" r="7" fill="#141C27" stroke="#2B394E" strokeWidth="1.5" />
          </G>

          {/* ============================================================== */}
          {/* LỚP 6: CẦN GẠT ANALOG PHẢI 3D (Right Stick / R3)              */}
          {/* ============================================================== */}
          <G onPress={() => onButtonPress?.('R3')}>
            {/* Hốc cầu lõm sâu trong vỏ */}
            <Circle cx="330" cy="225" r="39" fill="url(#stickWellGrad)" stroke="url(#chromeRing)" strokeWidth="2.5" />
            <Circle cx="330" cy="225" r="37.5" fill="none" stroke="#05080C" strokeWidth="1.5" />

            {/* Vòng ngưỡng vùng chết */}
            <Circle
              cx="330"
              cy="225"
              r={39 * rightDeadzone}
              fill="none"
              stroke="rgba(245, 158, 11, 0.45)"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />

            {/* Đổ bóng 3D của trụ cần gạt di chuyển theo chiều ngược lại */}
            <Ellipse
              cx={330 - rStickDx * 0.3}
              cy={227 - rStickDy * 0.3}
              rx="24"
              ry="21"
              fill="#000000"
              opacity={0.65}
            />

            {/* Mũ cần gạt (Thumbstick Cap) di chuyển theo thời gian thực */}
            <G transform={`translate(${rStickDx}, ${rStickDy}) scale(${isR3 ? 0.94 : 1})`} origin="330, 225">
              {/* Vành cao su ngoài */}
              <Circle
                cx="330"
                cy="225"
                r="24"
                fill={isR3 ? colorActive : 'url(#stickCapGrad)'}
                stroke={isR3 ? '#FFFFFF' : '#3C4B61'}
                strokeWidth={isR3 ? 2.5 : 2}
              />
              {/* Vòng gai nhám */}
              <Circle
                cx="330"
                cy="225"
                r="21.5"
                fill="none"
                stroke={isR3 ? '#93C5FD' : '#2C384B'}
                strokeWidth="1.5"
                strokeDasharray="2,3"
              />

              {/* 4 rãnh định hướng bám tay */}
              <Rect x="328.5" y="202.5" width="3" height="3" rx="1" fill="#4B5E78" />
              <Rect x="328.5" y="244.5" width="3" height="3" rx="1" fill="#4B5E78" />
              <Rect x="307.5" y="223.5" width="3" height="3" rx="1" fill="#4B5E78" />
              <Rect x="349.5" y="223.5" width="3" height="3" rx="1" fill="#4B5E78" />

              {/* Lòng bát lõm ngón tay cái */}
              <Circle
                cx="330"
                cy="225"
                r="16.5"
                fill={isR3 ? '#005BBB' : 'url(#stickCupGrad)'}
                stroke="#1B2433"
                strokeWidth="1.5"
              />

              {/* Vệt sáng cong vát 3D */}
              <Path
                d="M 319 219 C 323 213, 337 213, 341 219"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />

              {/* Chấm tâm & Nhãn R3 */}
              <Circle cx="330" cy="224" r="3.5" fill={isR3 ? '#FFFFFF' : colorActive} />
              <SvgText
                x="330"
                y="237"
                fill={isR3 ? '#FFFFFF' : '#889BB5'}
                fontSize="7.5"
                fontWeight="bold"
                textAnchor="middle"
              >
                R3
              </SvgText>
            </G>
          </G>

          {/* ============================================================== */}
          {/* LỚP 7: CỤM NÚT BẤM 3D PHA LÊ (Face Buttons: A, B, X, Y)        */}
          {/* ============================================================== */}
          <G>
            {/* Đĩa đệm hốc cụm nút kim cương */}
            <Circle cx="380" cy="145" r="44" fill="#0C1118" stroke="#1D2635" strokeWidth="1.8" />

            {/* NÚT Y (TRÊN) */}
            <G
              onPress={() => onButtonPress?.('Y')}
              transform={`scale(${isY ? 0.92 : 1})`}
              origin="380, 114"
            >
              <Circle
                cx="380"
                cy="114"
                r="14"
                fill={isY ? faceColors.top : 'url(#btnGemBase)'}
                stroke={isY ? '#FFFFFF' : '#3E506B'}
                strokeWidth={isY ? 2.5 : 1.5}
              />
              {/* Vệt bóng kính phản quang 3D */}
              <Path
                d="M 373 108 C 376 104, 384 104, 387 108"
                stroke={isY ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)'}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              <SvgText
                x="380"
                y="119"
                fill={isY ? '#000000' : faceColors.top}
                fontSize="12.5"
                fontWeight="900"
                textAnchor="middle"
              >
                {faceLabels.top}
              </SvgText>
            </G>

            {/* NÚT A (DƯỚI) */}
            <G
              onPress={() => onButtonPress?.('A')}
              transform={`scale(${isA ? 0.92 : 1})`}
              origin="380, 176"
            >
              <Circle
                cx="380"
                cy="176"
                r="14"
                fill={isA ? faceColors.bottom : 'url(#btnGemBase)'}
                stroke={isA ? '#FFFFFF' : '#3E506B'}
                strokeWidth={isA ? 2.5 : 1.5}
              />
              {/* Vệt bóng kính phản quang 3D */}
              <Path
                d="M 373 170 C 376 166, 384 166, 387 170"
                stroke={isA ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)'}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              <SvgText
                x="380"
                y="181"
                fill={isA ? '#000000' : faceColors.bottom}
                fontSize="12.5"
                fontWeight="900"
                textAnchor="middle"
              >
                {faceLabels.bottom}
              </SvgText>
            </G>

            {/* NÚT X (TRÁI) */}
            <G
              onPress={() => onButtonPress?.('X')}
              transform={`scale(${isX ? 0.92 : 1})`}
              origin="349, 145"
            >
              <Circle
                cx="349"
                cy="145"
                r="14"
                fill={isX ? faceColors.left : 'url(#btnGemBase)'}
                stroke={isX ? '#FFFFFF' : '#3E506B'}
                strokeWidth={isX ? 2.5 : 1.5}
              />
              {/* Vệt bóng kính phản quang 3D */}
              <Path
                d="M 342 139 C 345 135, 353 135, 356 139"
                stroke={isX ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)'}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              <SvgText
                x="349"
                y="150"
                fill={isX ? '#000000' : faceColors.left}
                fontSize="12.5"
                fontWeight="900"
                textAnchor="middle"
              >
                {faceLabels.left}
              </SvgText>
            </G>

            {/* NÚT B (PHẢI) */}
            <G
              onPress={() => onButtonPress?.('B')}
              transform={`scale(${isB ? 0.92 : 1})`}
              origin="411, 145"
            >
              <Circle
                cx="411"
                cy="145"
                r="14"
                fill={isB ? faceColors.right : 'url(#btnGemBase)'}
                stroke={isB ? '#FFFFFF' : '#3E506B'}
                strokeWidth={isB ? 2.5 : 1.5}
              />
              {/* Vệt bóng kính phản quang 3D */}
              <Path
                d="M 404 139 C 407 135, 415 135, 418 139"
                stroke={isB ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)'}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
              <SvgText
                x="411"
                y="150"
                fill={isB ? '#000000' : faceColors.right}
                fontSize="12.5"
                fontWeight="900"
                textAnchor="middle"
              >
                {faceLabels.right}
              </SvgText>
            </G>
          </G>

          {/* ============================================================== */}
          {/* LỚP 8: CỤM ĐIỀU KHIỂN TRUNG TÂM & NÚT NEXUS PHÁT SÁNG          */}
          {/* ============================================================== */}
          {/* NÚT GUIDE / HOME PHÁT QUANG ĐỈNH CAO */}
          <G onPress={() => onButtonPress?.('Guide')}>
            {/* Quầng sáng Neon tỏa ra xung quanh */}
            <Circle cx="270" cy="112" r="23" fill="url(#nexusGlow)" />
            {/* Vành viền kim loại Chrome */}
            <Circle cx="270" cy="112" r="16" fill="#131B26" stroke="url(#chromeRing)" strokeWidth="2" />
            <Circle cx="270" cy="112" r="13" fill="#1A2433" stroke="#2B3A4F" strokeWidth="1" />

            {/* Biểu tượng Nexus tỏa sáng */}
            <Path
              d="M 263 107 C 266 111, 274 111, 277 107 M 261 116 C 266 111, 274 111, 279 116"
              stroke={colorActiveGlow}
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
          </G>

          {/* DẢI 4 ĐÈN LED CHỈ THỊ NGƯỜI CHƠI (Player Indicator LEDs) */}
          <G>
            <Rect x="259" y="132" width="4" height="2.5" rx="1" fill="#38BDF8" />
            <Rect x="265" y="132" width="4" height="2.5" rx="1" fill="#1E2A3A" />
            <Rect x="271" y="132" width="4" height="2.5" rx="1" fill="#1E2A3A" />
            <Rect x="277" y="132" width="4" height="2.5" rx="1" fill="#1E2A3A" />
          </G>

          {/* NÚT BACK / VIEW / SELECT */}
          <G onPress={() => onButtonPress?.('Back')}>
            <Rect
              x="225"
              y="136"
              width="23"
              height="15"
              rx="5"
              fill={isBack ? colorActive : '#1E2838'}
              stroke={isBack ? '#FFFFFF' : '#394A61'}
              strokeWidth={isBack ? 2 : 1.2}
            />
            <SvgText
              x="236.5"
              y="147.5"
              fill={isBack ? '#FFFFFF' : '#94A3B8'}
              fontSize="9"
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
              width="23"
              height="15"
              rx="5"
              fill={isStart ? colorActive : '#1E2838'}
              stroke={isStart ? '#FFFFFF' : '#394A61'}
              strokeWidth={isStart ? 2 : 1.2}
            />
            <SvgText
              x="303.5"
              y="147.5"
              fill={isStart ? '#FFFFFF' : '#94A3B8'}
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
            >
              ☰
            </SvgText>
          </G>

          {/* ============================================================== */}
          {/* LỚP 9: CHÚ THÍCH DẠNG CALLOUT CHỈ VÀO THIẾT BỊ                 */}
          {/* ============================================================== */}
          {showCallouts && (
            <G opacity={0.95}>
              {/* Callout Cần trái L3 */}
              <Path d="M 50 145 L 120 145" stroke={colorCalloutLine} strokeWidth="1.2" />
              <Circle cx="120" cy="145" r="2.5" fill={colorCalloutText} />
              <SvgText x="44" y="148" fill={colorCalloutText} fontSize="9.5" fontWeight="600" textAnchor="end">
                Cần trái / L3
              </SvgText>

              {/* Callout D-Pad */}
              <Path d="M 65 225 L 174 225" stroke={colorCalloutLine} strokeWidth="1.2" />
              <Circle cx="174" cy="225" r="2.5" fill={colorCalloutText} />
              <SvgText x="59" y="228" fill={colorCalloutText} fontSize="9.5" fontWeight="600" textAnchor="end">
                D-Pad
              </SvgText>

              {/* Callout Cò trái LT */}
              <Path d="M 85 28 L 122 28 L 138 38" stroke={colorCalloutLine} strokeWidth="1.2" fill="none" />
              <Circle cx="138" cy="38" r="2.5" fill={colorCalloutText} />
              <SvgText x="80" y="31" fill={colorCalloutText} fontSize="9.5" fontWeight="600" textAnchor="end">
                Cò trái (LT)
              </SvgText>

              {/* Callout Cò phải RT */}
              <Path d="M 455 28 L 418 28 L 402 38" stroke={colorCalloutLine} strokeWidth="1.2" fill="none" />
              <Circle cx="402" cy="38" r="2.5" fill={colorCalloutText} />
              <SvgText x="460" y="31" fill={colorCalloutText} fontSize="9.5" fontWeight="600" textAnchor="start">
                Cò phải (RT)
              </SvgText>

              {/* Callout Cụm nút hành động */}
              <Path d="M 482 145 L 426 145" stroke={colorCalloutLine} strokeWidth="1.2" />
              <Circle cx="426" cy="145" r="2.5" fill={colorCalloutText} />
              <SvgText x="488" y="148" fill={colorCalloutText} fontSize="9.5" fontWeight="600" textAnchor="start">
                Nút hành động
              </SvgText>

              {/* Callout Cần phải R3 */}
              <Path d="M 468 225 L 370 225" stroke={colorCalloutLine} strokeWidth="1.2" />
              <Circle cx="370" cy="225" r="2.5" fill={colorCalloutText} />
              <SvgText x="474" y="228" fill={colorCalloutText} fontSize="9.5" fontWeight="600" textAnchor="start">
                Cần phải / R3
              </SvgText>
            </G>
          )}
        </Svg>
      </View>
    </View>
  );
}

// Xuất thêm alias Gamepad3DVisualizer
export { Gamepad2DVisualizer as Gamepad3DVisualizer };

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#070A10',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
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
});
