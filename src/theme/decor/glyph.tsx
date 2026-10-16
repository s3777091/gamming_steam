// Ký hiệu mùa dùng chung. Tách riêng (không phụ thuộc ThemeProvider) để cả hiệu ứng đổi
// theme lẫn các dấu ấn mùa đều dùng được mà không tạo vòng import.

import { Crown, Flower2, Ghost, Snowflake, type LucideIcon } from 'lucide-react-native';

import type { SeasonGlyph } from '../types';

const GLYPHS: Record<SeasonGlyph, LucideIcon> = {
  snowflake: Snowflake,
  ghost: Ghost,
  blossom: Flower2,
  crown: Crown,
};

export function SeasonGlyphIcon({ glyph, size, color }: { glyph: SeasonGlyph; size: number; color: string }) {
  const Icon = GLYPHS[glyph];
  return <Icon size={size} color={color} strokeWidth={2} />;
}
