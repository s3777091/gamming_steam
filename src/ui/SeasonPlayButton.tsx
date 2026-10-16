import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

import { useDecorEnabled, useTheme } from '@/theme/ThemeProvider';
import { MaterialTexture } from '@/theme/decor/MaterialTexture';
import { SeasonSweep, useSeasonFeedback } from '@/theme/decor/feedback';
import { Press } from './Press';

type Props = Omit<ComponentProps<typeof Press>, 'children'> & {
  size: number;
  seasonal?: boolean;
  children?: ReactNode | ((ink: string) => ReactNode);
};

/** Nút Play dùng chung cho Games, PC và xem trước; giữ icon và thao tác gốc. */
export function SeasonPlayButton({ size, seasonal = true, disabled, onPress, onFocused, children, style, ...props }: Props) {
  const { material, colors } = useTheme();
  const enabled = useDecorEnabled();
  const decorated = seasonal && enabled && material.kind !== 'glass';
  const { progress, play, allowed } = useSeasonFeedback(decorated && !disabled);
  return (
    <Press {...props} disabled={disabled}
      style={[style, decorated && { borderColor: material.actionRim, shadowColor: material.textureColor, shadowOpacity: 0.24, shadowRadius: size * 0.23, elevation: 6 }]}
      onPress={(event) => { play(); onPress?.(event); }}
      onFocused={() => { play(); onFocused?.(); }}>
      {decorated ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>
          <LinearGradient colors={material.actionFill} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <MaterialTexture compact />
          <Svg width="100%" height="100%" viewBox="0 0 44 44">
            <Circle cx="22" cy="22" r="19.5" fill="none" stroke={material.actionRim} strokeWidth={material.kind === 'frost' ? 1.2 : 0.7}
              strokeDasharray={material.kind === 'frost' ? '3 5' : undefined} />
            {material.kind === 'lacquer' ? <Circle cx="22" cy="22" r="17.3" fill="none" stroke={material.actionRim} strokeWidth="0.4" /> : null}
            {material.kind === 'haunted' ? <Path d="M6 12L13 7M5 17L10 12M28 38L37 29" stroke={material.actionRim} strokeWidth="0.7" /> : null}
            {material.kind === 'gilded' ? <Path d="M22 3L24 6L22 9L20 6ZM22 35L24 38L22 41L20 38Z" fill={material.actionRim} /> : null}
          </Svg>
          {allowed ? <SeasonSweep progress={progress} compact /> : null}
        </View>
      ) : null}
      {typeof children === 'function' ? children(decorated ? material.actionInk : colors.white) : children}
    </Press>
  );
}
