import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type View as NativeView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { glass } from '@/theme';

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
  const blurTarget = useContext(GlassBlurTargetContext);
  const isControl = material === 'control';
  const isScrim = material === 'scrim';
  const resolvedIntensity = intensity ?? (isControl ? 42 : isScrim ? 18 : 34);
  const overlay = isControl
    ? glass.controlOverlay
    : isScrim
      ? glass.scrim
      : glass.panelOverlay;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <BlurView
        blurTarget={blurTarget ?? undefined}
        blurMethod={Platform.OS === 'android' && blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurReductionFactor={3}
        intensity={resolvedIntensity}
        tint={isControl ? 'systemUltraThinMaterialDark' : 'dark'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      {!isScrim ? (
        <LinearGradient
          colors={isControl
            ? ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.025)', 'transparent']
            : ['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.012)', 'transparent']}
          locations={[0, 0.34, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
