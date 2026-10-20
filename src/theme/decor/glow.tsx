// Chấm sáng mềm bằng radial gradient: thay cho blur (đắt trên Android) để hạt và bokeh
// trông như ngoài vùng lấy nét, không có viền cứng.

import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

const SMALL = 6;

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
  // Chấm nhỏ hơn vài pixel thì gradient không nhìn ra khác biệt; mỗi Svg là một view native
  // riêng nên với hàng chục hạt, chấm tròn thường nhẹ hơn hẳn.
  if (width <= SMALL && height <= SMALL) {
    return (
      <View
        style={{
          width,
          height,
          borderRadius: Math.max(width, height) / 2,
          backgroundColor: color,
          opacity: opacity * (0.55 + core * 0.45),
        }}
      />
    );
  }
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
