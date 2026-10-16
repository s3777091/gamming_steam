import { Text, type TextProps, type TextStyle } from 'react-native';

// Đi thẳng vào file con để tránh vòng import: dấu ấn mùa của theme cũng dùng T.
import { fonts } from '@/theme/static';
import { useTheme } from '@/theme/ThemeProvider';
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
  size = 12, weight = 'medium', color, tracking, leading, tabular, style, ...rest
}: TProps) {
  const { colors } = useTheme();
  const { s } = useUi();
  const base: TextStyle = {
    fontFamily: fonts[weight],
    fontSize: s(size),
    color: color ?? colors.text,
    ...(tracking != null ? { letterSpacing: s(size) * tracking } : null),
    ...(leading != null ? { lineHeight: s(size) * leading } : null),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
    includeFontPadding: false,
  };
  return <Text {...rest} style={[base, style]} />;
}
