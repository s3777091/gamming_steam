import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts } from '@/theme';
import { useUi } from './scale';

type Weight = keyof typeof fonts;

export type TProps = TextProps & {
  /** Cỡ chữ ở khung thiết kế 932x430. */
  size?: number;
  weight?: Weight;
  color?: string;
  tracking?: number;
  leading?: number;
  tabular?: boolean;
};

/** Chữ Inter đã co giãn theo màn hình; mọi chữ trong app đi qua đây. */
export function T({
  size = 12, weight = 'medium', color = colors.text, tracking, leading, tabular, style, ...rest
}: TProps) {
  const { s } = useUi();
  const base: TextStyle = {
    fontFamily: fonts[weight],
    fontSize: s(size),
    color,
    ...(tracking != null ? { letterSpacing: s(size) * tracking } : null),
    ...(leading != null ? { lineHeight: s(size) * leading } : null),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
    includeFontPadding: false,
  };
  return <Text {...rest} style={[base, style]} />;
}
