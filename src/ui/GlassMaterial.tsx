import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type View as NativeView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme';
import { MaterialTexture } from '@/theme/decor/MaterialTexture';

type GlassMaterial = 'control' | 'panel' | 'scrim';

const GlassBlurTargetContext = createContext<RefObject<NativeView | null> | null>(null);

export function GlassBlurProvider({
  targetRef,
  children,
}: {
  targetRef: RefObject<NativeView | null>;
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
