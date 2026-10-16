import { memo, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useDecorEnabled, useTheme } from '../ThemeProvider';

const GRAIN = {
  glass: '',
  frost: 'M-8 58L44 6L83 17L128 -8M18 32L13 9M29 21L53 27M61 11L70 35M88 61L112 37L124 40',
  haunted: 'M-4 24L19 20L25 27L41 22L48 35L67 31M26 27L22 43L31 55M82 -4L77 11L86 18L79 34L92 42L89 68',
  lacquer: 'M-12 12C24 4 43 23 78 14S111 9 132 17M-12 35C22 27 46 43 80 35S111 30 132 37M-12 56C25 48 48 64 82 56S112 52 132 59',
  gilded: 'M0 7H90M40 16H120M9 25H110M0 35H77M28 44H120M0 53H99M60 61H120',
} as const;

/** Vân tĩnh, chỉ gắn vào card đang chọn và panel lớn; không tạo bộ lọc hay vòng lặp. */
export const MaterialTexture = memo(function MaterialTexture({ compact = false }: { compact?: boolean }) {
  const { material } = useTheme();
  const enabled = useDecorEnabled();
  const patternId = `grain-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!enabled || material.textureOpacity === 0) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity: material.textureOpacity * (compact ? 0.7 : 1) }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={patternId} width={120} height={64} patternUnits="userSpaceOnUse">
            <Path d={GRAIN[material.kind]} fill="none" stroke={material.textureColor} strokeWidth={material.kind === 'gilded' ? 0.6 : 0.8} strokeLinecap="round" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
});
