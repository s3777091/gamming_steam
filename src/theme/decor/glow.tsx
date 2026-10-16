// Chấm sáng mềm bằng radial gradient: thay cho blur (đắt trên Android) để hạt và bokeh
// trông như ngoài vùng lấy nét, không có viền cứng.

import { useId } from 'react';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

export function Glow({
  width,
  height = width,
  color,
  opacity = 1,
  core = 0,
}: {
  width: number;
  height?: number;
  color: string;
  /** Độ đậm ở tâm. */
  opacity?: number;
  /** 0..1: phần tâm giữ nguyên độ đậm trước khi mờ dần ra mép (0 = mờ ngay từ tâm). */
  core?: number;
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset={core} stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
