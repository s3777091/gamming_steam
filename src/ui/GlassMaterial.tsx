import { createContext, memo, useContext, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type View as NativeView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme';
import { MaterialTexture } from '@/theme/decor/MaterialTexture';
import { useMenuGlass } from './menuGlass';

type GlassMaterial = 'control' | 'panel' | 'scrim';

const GlassBlurTargetContext = createContext<RefObject<NativeView | null> | null>(null);

/**
 * Kính theo theme cho menu nổi: chỉ panel blur backdrop (một lần), nút con chỉ có màu
 * kính + ánh sheen của chất liệu theme. Panel mang thêm vân chất liệu (băng, sơn mài...).
 */
export const MenuGlassBackdrop = memo(function MenuGlassBackdrop({ radius = 18, variant = 'panel', blur = true }: {
  radius?: number;
  variant?: 'panel' | 'control';
  blur?: boolean;
}) {
  const { material: surface } = useTheme();
  const menu = useMenuGlass();
  const target = useContext(GlassBlurTargetContext);
  const isPanel = variant === 'panel';
  const blurred = blur && isPanel && surface.panelBlur > 0 && (Platform.OS !== 'android' || Boolean(target));
  const fill = !isPanel ? menu.control : blurred ? menu.panelTint : menu.panelFallback;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      {blurred ? <BlurView
        blurTarget={target ?? undefined}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurReductionFactor={4} intensity={surface.panelBlur} tint="dark"
        style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      <LinearGradient colors={isPanel ? surface.panelSheen : surface.controlSheen}
        locations={[0, 0.34, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.9 }} style={StyleSheet.absoluteFill} />
      {isPanel ? <MaterialTexture /> : null}
    </View>
  );
});

/**
 * Android: mỗi BlurView blur LẠI TOÀN BỘ target ở độ phân giải gốc mỗi frame, dù bản thân
 * nó chỉ to bằng cái nút (Dimezis BlurView 3, đường RenderNode). Chừng 8 lớp kính cùng lúc
 * là lấp đầy cache GPU, ảnh phải upload lại mỗi frame và app tụt còn ~10 fps. `null` tắt
 * blur thật cho nhánh con (chỉ còn màu kính) — dùng cho phần bị lớp phủ che hoặc lớp phủ
 * kín màn hình, nơi blur không nhìn thấy được.
 */
export function GlassBlurProvider({
  targetRef,
  children,
}: {
  targetRef: RefObject<NativeView | null> | null;
  children: ReactNode;
}) {
  return (
    <GlassBlurTargetContext.Provider value={targetRef}>
      {children}
    </GlassBlurTargetContext.Provider>
  );
}

/**
 * Lớp vật liệu dùng chung cho console.
 *
 * `control` giữ kính trong cho header controls. `panel` thêm lớp than đen để
 * nội dung luôn đọc rõ trên artwork. `scrim` chỉ làm tối và tách lớp giao diện.
 */
export function GlassBackdrop({
  material,
  intensity,
  radius = 0,
}: {
  material: GlassMaterial;
  intensity?: number;
  radius?: number;
}) {
  const { glass, material: surface } = useTheme();
  const blurTarget = useContext(GlassBlurTargetContext);
  const isControl = material === 'control';
  const isScrim = material === 'scrim';
  const resolvedIntensity = isScrim ? (intensity ?? 18)
    : Math.min(100, (intensity ?? (isControl ? 42 : 34)) * (isControl ? surface.controlBlur / 42 : surface.panelBlur / 34));
  const overlay = isControl
    ? glass.controlOverlay
    : isScrim
      ? glass.scrim
      : glass.panelOverlay;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      {resolvedIntensity > 0 ? <BlurView
        // Gắn lại khi bật/tắt blur thật: expo-blur đổi target lúc đang chạy không sạch.
        key={blurTarget ? 'live' : 'flat'}
        blurTarget={blurTarget ?? undefined}
        blurMethod={Platform.OS === 'android' && blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurReductionFactor={3}
        intensity={resolvedIntensity}
        tint={isControl ? 'systemUltraThinMaterialDark' : 'dark'}
        style={StyleSheet.absoluteFill}
      /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      {!isScrim ? (
        <LinearGradient
          colors={isControl ? surface.controlSheen : surface.panelSheen}
          locations={[0, 0.34, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {material === 'panel' ? <MaterialTexture /> : null}
    </View>
  );
}
