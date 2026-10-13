import { forwardRef, type ReactNode, type RefObject } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { BlurView, type BlurViewProps } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { glass } from '@/theme';

export interface LiquidGlassProps extends ViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Độ mờ quang học của kính (0 - 100), mặc định 45 */
  intensity?: number;
  /** Tông màu kính */
  tint?: BlurViewProps['tint'];
  /** Bo góc squircle (dp), mặc định 16 */
  radius?: number;
  /** Độ đậm viền phản chiếu ánh sáng (0 - 1), mặc định 1 */
  specular?: boolean | number;
  /** Màu nền cơ sở bán trong suốt */
  glassBg?: string;
  /** Có hiển thị lớp phủ phản quang chéo hay không */
  sheen?: boolean;
  /** Hiệu ứng viền phát sáng màu accent (iOS 26 dynamic rim) */
  accentRim?: boolean;
  /** Đổ bóng mềm tạo chiều sâu đa tầng */
  elevated?: boolean;
  /** Android SDK 57 cần BlurTargetView để render blur thật. */
  blurTarget?: RefObject<View | null>;
}

/**
 * Bề mặt kính lỏng Apple (Liquid Glass Surface - iOS 26):
 * - Nền làm mờ quang học (BlurView) tạo cảm giác chiều sâu tự nhiên.
 * - Lớp viền phản chiếu ánh sáng (Specular Rim Lighting) ở cạnh trên và viền ngoài.
 * - Lớp phản quang gradient tinh tế tạo hiệu ứng khúc xạ ánh sáng đa góc.
 * - Đổ bóng nổi mềm mại (Soft ambient shadows) chuẩn Apple HIG.
 */
export const LiquidGlass = forwardRef<View, LiquidGlassProps>(function LiquidGlass(
  {
    children,
    style,
    intensity = 45,
    tint = 'dark',
    radius = 16,
    specular = true,
    glassBg = glass.surface,
    sheen = true,
    accentRim = false,
    elevated = true,
    blurTarget,
    ...rest
  },
  ref,
) {
  const specularAlpha = typeof specular === 'number' ? specular : specular ? 1 : 0;

  return (
    <View
      ref={ref}
      {...rest}
      style={[
        styles.container,
        {
          borderRadius: radius,
          backgroundColor: glassBg,
          borderColor: accentRim ? 'rgba(102, 168, 255, 0.38)' : glass.borderSubtle,
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      {/* 1. Lớp làm mờ quang học Liquid Glass Blur */}
      <BlurView
        intensity={intensity}
        tint={tint}
        blurTarget={blurTarget}
        blurMethod={Platform.OS === 'android' && blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurReductionFactor={3}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      />

      {/* 2. Lớp phản quang khúc xạ ánh sáng (Light Refraction Sheen) */}
      {sheen ? (
        <LinearGradient
          colors={[
            `rgba(255, 255, 255, ${0.18 * specularAlpha})`,
            `rgba(255, 255, 255, ${0.04 * specularAlpha})`,
            'rgba(255, 255, 255, 0)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.9 }}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}

      {/* 3. Vành sáng viền cạnh trên (Specular Top Edge Rim) */}
      {specularAlpha > 0 ? (
        <LinearGradient
          colors={[
            `rgba(255, 255, 255, ${0.55 * specularAlpha})`,
            `rgba(255, 255, 255, ${0.12 * specularAlpha})`,
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          style={[
            styles.specularTopLine,
            {
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
            },
          ]}
        />
      ) : null}

      {/* 4. Nội dung con */}
      {children}
    </View>
  );
});

/**
 * Nền chất lỏng phát sáng (Liquid Ambient Aurora):
 * Tạo các khối màu chuyển động/chìm nổi mềm mại phía sau các lớp kính mờ.
 */
export function LiquidAmbientAurora({
  active = true,
  opacity = 0.85,
}: {
  active?: boolean;
  opacity?: number;
}) {
  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Orb 1: Electric Azure Glow (Góc trên trái) */}
      <LinearGradient
        colors={['rgba(31, 111, 235, 0.42)', 'rgba(31, 111, 235, 0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.6 }}
        style={[
          styles.orb,
          {
            top: '-20%',
            left: '-15%',
            width: '60%',
            height: '110%',
            opacity,
          },
        ]}
      />

      {/* Orb 2: Deep Violet / Indigo Glow (Trung tâm & bên phải) */}
      <LinearGradient
        colors={['rgba(120, 86, 255, 0.35)', 'rgba(88, 86, 214, 0.08)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.orb,
          {
            top: '-10%',
            right: '-10%',
            width: '65%',
            height: '95%',
            opacity: opacity * 0.9,
          },
        ]}
      />

      {/* Orb 3: Cyan / Teal Refraction Flare (Dưới phải) */}
      <LinearGradient
        colors={['rgba(0, 242, 254, 0.22)', 'rgba(32, 156, 255, 0.05)', 'transparent']}
        start={{ x: 0.8, y: 0.8 }}
        end={{ x: 0.1, y: 0.1 }}
        style={[
          styles.orb,
          {
            bottom: '-25%',
            right: '5%',
            width: '55%',
            height: '85%',
            opacity: opacity * 0.8,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
  },
  elevated: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
      },
    }),
  },
  specularTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
});
