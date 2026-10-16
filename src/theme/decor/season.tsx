// Dấu ấn mùa gắn vào các vị trí có sẵn của giao diện, theo cách các nền tảng lớn làm:
// khung avatar, điểm nhấn cạnh đồng hồ, huy hiệu nhỏ trên icon và lời chúc ở màn loading.
// Theme có asset vẽ tay thì dùng ảnh; chưa có thì dùng bản dựng đơn giản bên dưới.
// Tất cả tắt theo công tắc "Hiệu ứng trang trí".

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { useDecorEnabled, useTheme } from '../ThemeProvider';
import type { SeasonSpec } from '../types';
import { SeasonGlyphIcon } from './glyph';
import { SeasonalCorners } from './surfaces';

/** Mùa của theme đang dùng, hoặc null khi theme không theo mùa / người dùng tắt trang trí. */
export function useSeason(): SeasonSpec | null {
  const { decor } = useTheme();
  const enabled = useDecorEnabled();
  return enabled ? (decor.season ?? null) : null;
}

/** Huy hiệu tròn nhỏ mang ký hiệu mùa. */
function Medallion({ season, size }: { season: SeasonSpec; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.panelSolid,
        borderWidth: 1,
        borderColor: colors.accent,
      }}
    >
      <SeasonGlyphIcon glyph={season.glyph} size={size * 0.62} color={colors.accentGlow} />
    </View>
  );
}

/** Khung avatar theo mùa (kiểu avatar decoration). `size` là cạnh avatar bên trong. */
export function AvatarFrame({ size, children }: { size: number; children: ReactNode }) {
  const { material } = useTheme();
  const { s, scale } = useUi();
  const season = useSeason();
  if (!season) return <>{children}</>;

  const art = season.assets?.avatarFrame;
  if (art) {
    const frame = size / 0.7;
    return (
      <View style={{ width: size, height: size }}>
        {children}
        <Image
          source={art}
          pointerEvents="none"
          contentFit="contain"
          style={{ position: 'absolute', width: frame, height: frame, left: (size - frame) / 2, top: (size - frame) / 2 }}
        />
      </View>
    );
  }

  const ring = s(material.kind === 'frost' ? 3 : 2);
  const badge = s(14);
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        pointerEvents="none"
        colors={material.frame}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: -ring, top: -ring, width: size + ring * 2, height: size + ring * 2, borderRadius: size }}
      />
      {children}
      <SeasonalCorners size={size / scale * 0.72} twin={false} inset={-3} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -badge * 0.35, left: -badge * 0.35 }}>
        <Medallion season={season} size={badge} />
      </View>
    </View>
  );
}

/** Điểm nhấn cạnh đồng hồ trên thanh trên cùng. */
export function HeaderAccent() {
  const { colors } = useTheme();
  const { s } = useUi();
  const season = useSeason();
  if (!season) return null;
  const art = season.assets?.headerAccent;
  if (art) return <Image source={art} contentFit="contain" style={{ width: s(20), height: s(20), marginRight: s(5) }} />;
  return (
    <View style={{ marginRight: s(5) }}>
      <SeasonGlyphIcon glyph={season.glyph} size={s(12)} color={colors.accentSoft} />
    </View>
  );
}

/** Icon theo mùa: giữ nguyên icon gốc (dễ nhận ra), gắn huy hiệu mùa nhỏ ở góc dưới phải. */
export function SeasonalIcon({ children }: { children: ReactNode }) {
  const { s } = useUi();
  const season = useSeason();
  return (
    <View style={styles.relative}>
      {children}
      {season ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: -s(3), bottom: -s(3) }}>
          <Medallion season={season} size={s(12)} />
        </View>
      ) : null}
    </View>
  );
}

/** Lời chúc mùa trên màn loading stream. */
export function SeasonGreeting() {
  const { colors } = useTheme();
  const { s } = useUi();
  const season = useSeason();
  if (!season?.greeting) return null;
  const art = season.assets?.loadingBadge;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      {art ? (
        <Image source={art} contentFit="contain" style={{ width: s(18), height: s(18) }} />
      ) : (
        <SeasonGlyphIcon glyph={season.glyph} size={s(12)} color={colors.accentSoft} />
      )}
      <T size={11} weight="semibold" color={colors.accentSoft} tracking={0.02}>
        {season.greeting}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  relative: { position: 'relative', overflow: 'visible' },
});
