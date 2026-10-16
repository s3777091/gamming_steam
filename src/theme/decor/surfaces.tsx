import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

import { useUi } from '@/ui/scale';

import { alpha } from '../color';
import { useDecorEnabled, useTheme } from '../ThemeProvider';
import type { MaterialKind } from '../types';
import { MaterialTexture } from './MaterialTexture';
import { SelectionFeedback } from './feedback';

/** Họa tiết tĩnh ở mép, không tạo thêm vòng animation cho từng card trong kệ. */
function CornerOrnament({ kind, size, color }: { kind: MaterialKind; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {kind === 'frost' ? (
        <>
          <Path d="M2 4H44V46M10 4V11L13 8L16 15L19 7M26 4L29 13L32 7M44 18L36 22L42 26M44 32L37 36" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
          <Path d="M28 24V38M21 31H35M23 26L33 36M33 26L23 36" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        </>
      ) : kind === 'haunted' ? (
        <>
          <Path d="M46 2L4 16M46 2L16 32M46 2L32 44M46 2V46M32 7Q34 16 46 18M21 11Q26 28 46 30M10 14Q17 40 46 43M37 11Q35 17 39 21M28 20Q24 25 28 31" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
          <Circle cx="34" cy="21" r="2" fill={color} />
        </>
      ) : kind === 'lacquer' ? (
        <>
          <Path d="M46 3C24 4 39 24 14 33M34 15L24 11M29 24L37 31M18 32L15 42" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
          {[{ x: 25, y: 12 }, { x: 36, y: 30 }, { x: 15, y: 35 }].map(({ x, y }) => (
            <Path key={x} d={`M${x} ${y - 5}C${x + 4} ${y - 7} ${x + 7} ${y - 1} ${x + 3} ${y + 1}C${x + 6} ${y + 6} ${x} ${y + 8} ${x - 2} ${y + 3}C${x - 8} ${y + 3} ${x - 7} ${y - 3} ${x - 3} ${y - 3}C${x - 4} ${y - 7} ${x} ${y - 8} ${x} ${y - 5}Z`} fill={color} fillOpacity="0.65" />
          ))}
        </>
      ) : kind === 'gilded' ? (
        <>
          <Path d="M6 4H44V42M18 8H40V30M32 4L44 16M8 12H26M36 34V42" stroke={color} strokeWidth="1.2" strokeLinecap="square" />
          <Path d="M34 9L38 13L34 17L30 13Z" fill={color} />
          <Circle cx="14" cy="12" r="1.5" fill={color} />
        </>
      ) : null}
    </Svg>
  );
}

export function SeasonalCorners({ size = 44, twin = true, inset = 3 }: { size?: number; twin?: boolean; inset?: number }) {
  const { material, colors, decor } = useTheme();
  const enabled = useDecorEnabled();
  const { s } = useUi();
  if (!enabled || !decor.season) return null;
  const color = material.kind === 'haunted' ? colors.accentSoft : material.frame[0];
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', top: s(inset), right: s(inset), opacity: 0.8 }}>
        <CornerOrnament kind={material.kind} size={s(size)} color={color} />
      </View>
      {twin ? (
        <View style={{ position: 'absolute', bottom: s(inset), left: s(inset), transform: [{ rotate: '180deg' }], opacity: 0.5 }}>
          <CornerOrnament kind={material.kind} size={s(size * 0.7)} color={color} />
        </View>
      ) : null}
    </View>
  );
}

/** Chất liệu chung cho thẻ Games, PC, Store và bản xem trước. */
export function CardSurface({ selected = false, radius = 16, shade = false, decorated = selected }: {
  selected?: boolean;
  radius?: number;
  shade?: boolean;
  decorated?: boolean;
}) {
  const { material, glass } = useTheme();
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <LinearGradient colors={shade ? material.artworkShade : material.sheen} locations={shade ? [0, 0.35, 0.7, 1] : [0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      {selected ? <LinearGradient colors={material.activeSheen} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.8 }} style={StyleSheet.absoluteFill} /> : null}
      {selected ? <MaterialTexture compact /> : null}
      <View style={[StyleSheet.absoluteFill, { borderWidth: StyleSheet.hairlineWidth, borderRadius: Math.max(0, radius - 1), borderColor: glass.cardInnerEdge }]} />
      {decorated ? <SeasonalCorners size={selected ? 44 : 28} twin={selected} /> : null}
      {selected && decorated ? <SelectionFeedback key={material.kind} /> : null}
    </View>
  );
}

/** Phản sáng nhẹ cho thẻ nội dung; không phủ màu tối lên chữ. */
export function SurfaceSheen() {
  const { material } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={material.kind === 'glass' ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.02)', 'transparent'] : material.rim}
      locations={[0, 0.4, 1]}
      style={[StyleSheet.absoluteFill, { height: '35%', opacity: material.kind === 'glass' ? 1 : 0.34 }]}
    />
  );
}

/** Ánh màu và họa tiết mép toa tàu; tan cùng lớp video. */
export function LoadingSeasonScenery() {
  const { colors, material, decor } = useTheme();
  const enabled = useDecorEnabled();
  if (!enabled || !decor.season) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[alpha(colors.card, 0.55), alpha(colors.card, 0), alpha(colors.panelSolid, 0.6)]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[alpha(material.frame[0], 0.14), alpha(material.frame[0], 0), alpha(colors.accent, 0.12)]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SeasonalCorners size={100} inset={8} />
    </View>
  );
}
