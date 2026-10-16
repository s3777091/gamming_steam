import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useUi } from '@/ui/scale';

import { useDecorEnabled, useTheme } from '../ThemeProvider';

/** Một góc cảnh tĩnh ở vùng trống phía trên bên phải; phần giữa dành cho artwork. */
export const SeasonScenery = memo(function SeasonScenery({ compact = false }: { compact?: boolean }) {
  const { material, colors, decor } = useTheme();
  const enabled = useDecorEnabled();
  const { s, width, height, insets } = useUi();
  if (!enabled || !decor.season) return null;
  const sceneWidth = compact ? s(156) : Math.min(s(270), width * 0.29, height * 0.65);
  const light = material.textureColor;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{
      position: 'absolute', right: compact ? 0 : insets.right + s(10),
      top: compact ? -s(8) : insets.top + s(62),
      width: sceneWidth, height: sceneWidth * 0.56, opacity: compact ? 0.24 : 0.3,
    }}>
      <Svg width="100%" height="100%" viewBox="0 0 320 180" fill="none">
        {material.kind === 'frost' ? (
          <>
            <Path d="M325 7C271 17 237 44 188 52S104 46 68 64" stroke={light} strokeWidth="2" />
            <Path d="M289 16L265 5M289 16L281 37M264 27L237 11M264 27L258 49M235 40L210 23M235 40L225 61M205 49L182 33M205 49L190 72M171 54L149 38M171 54L153 72M136 53L114 40M136 53L120 73M100 57L80 47M100 57L86 77" stroke={light} strokeWidth="1.6" strokeLinecap="round" />
            <Path d="M315 30Q218 91 104 84" stroke={colors.accentSoft} strokeWidth="1" />
            {[{ x: 274, y: 51 }, { x: 226, y: 70 }, { x: 173, y: 81 }, { x: 119, y: 85 }].map(({ x, y }, i) => (
              <G key={x}>
                <Circle cx={x} cy={y + 5} r="8" fill={i % 2 ? colors.accent : '#ffe3a1'} opacity="0.15" />
                <Path d={`M${x} ${y}v5`} stroke={light} />
                <Circle cx={x} cy={y + 7} r="2.5" fill={i % 2 ? colors.accentSoft : '#ffe3a1'} />
              </G>
            ))}
          </>
        ) : material.kind === 'haunted' ? (
          <>
            <Path d="M178 160V70C178 12 284 12 284 70V160M188 160V70C188 25 274 25 274 70V160M231 34V151M182 96H279" stroke={light} strokeWidth="1.6" />
            <Path d="M194 157V125H201V98L209 87L217 98V132H228V110H238V75L247 60L256 75V118H267V145H277V157Z" fill={colors.cardRaised} stroke={light} strokeWidth="0.8" />
            <Path d="M206 110V115M246 87V93M248 113V119M235 139V146" stroke={colors.accent} strokeWidth="2" />
            <Path d="M156 165H304M167 170H294" stroke={light} strokeWidth="1.2" />
          </>
        ) : material.kind === 'lacquer' ? (
          <>
            <Path d="M326 15C265 31 240 11 201 37S155 48 110 56M269 25L254 59M218 28L211 8M178 47L164 77M141 53L132 32" stroke={light} strokeWidth="1.8" strokeLinecap="round" />
            {[{ x: 252, y: 59 }, { x: 210, y: 12 }, { x: 164, y: 77 }, { x: 128, y: 32 }].map(({ x, y }) => (
              <G key={x}>
                {[0, 72, 144, 216, 288].map((angle) => <Ellipse key={angle} cx={x} cy={y - 5} rx="3.2" ry="5.2" fill={light} transform={`rotate(${angle} ${x} ${y})`} opacity="0.8" />)}
                <Circle cx={x} cy={y} r="2" fill={colors.accentGlow} />
              </G>
            ))}
            <Path d="M285 25V70M274 72H296M274 112H296M285 116V132M279 130V139M291 130V139" stroke={light} strokeWidth="1.3" />
            <Rect x="267" y="73" width="36" height="40" rx="15" fill={colors.primary} stroke={light} strokeWidth="1.1" />
            <Path d="M279 75Q273 93 279 111M291 75Q297 93 291 111" stroke={light} strokeWidth="0.7" />
          </>
        ) : material.kind === 'gilded' ? (
          <>
            <Path d="M236 29L285 52V109L236 153L187 109V52ZM236 37L277 57V106L236 143L195 106V57Z" stroke={light} strokeWidth="1.2" />
            <Path d="M209 74L221 85L236 61L251 85L263 74L255 104H217ZM217 111H255" fill={colors.accent} fillOpacity="0.14" stroke={light} strokeWidth="1.6" strokeLinejoin="round" />
            <Path d="M182 129Q155 94 174 60M175 111Q156 107 157 92Q175 93 175 111M170 88Q154 79 161 66Q176 73 170 88M289 129Q315 94 297 60M297 111Q315 107 314 92Q296 93 297 111M302 88Q318 79 311 66Q296 73 302 88" stroke={light} strokeWidth="1.2" />
            <Path d="M236 13L239 19L236 25L233 19Z" fill={light} />
          </>
        ) : null}
      </Svg>
    </View>
  );
});
