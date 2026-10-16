import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ScrollView } from 'react-native';
import { FocusScroll } from '@/features/gamepad/focus';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, ChevronRight } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { formatStorePrice } from '@/features/library/format';
import type { SteamPromotion, SteamStoreItem, StoreResponse } from '@/features/library/types';
import { nearbyBackdropUrls } from '@/lib/backdrop-preloader';
import { alpha, CardSurface, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useBackdropPreload } from '@/ui/useBackdropPreload';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const PREVIEW = { w: 220, h: 165 };
const IDLE = { w: 125, h: 80 };
const GAP = 10;
const SHELF_DISC = 42;
const SHELF_BLOCK = 52;
const SHELF_FILLET = 18;

function NotchFillet({ bottom, right }: { bottom: number; right: number }) {
  const { colors, id } = useTheme();
  const { s } = useUi();
  const size = s(SHELF_FILLET);
  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox={`0 0 ${SHELF_FILLET} ${SHELF_FILLET}`}
      style={{ position: 'absolute', bottom: s(bottom), right: s(right) }}
    >
      <Path
        d={`M ${SHELF_FILLET} 0 L ${SHELF_FILLET} ${SHELF_FILLET} L 0 ${SHELF_FILLET} A ${SHELF_FILLET} ${SHELF_FILLET} 0 0 0 ${SHELF_FILLET} 0 Z`}
        fill={id === 'console' ? '#060b13' : colors.bgDeep}
      />
    </Svg>
  );
}

function DiscountBadge({ percent, size = 9 }: { percent: number; size?: number }) {
  const { colors } = useTheme();
  const { s } = useUi();
  return (
    <View
      style={{
        backgroundColor: alpha(colors.primary, 0.42),
        borderRadius: s(8),
        paddingHorizontal: s(7),
        paddingVertical: s(2.5),
        borderWidth: 1,
        borderColor: alpha(colors.accentSoft, 0.7),
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <T size={size} weight="bold" color="#ffffff" tabular>-{percent}%</T>
    </View>
  );
}

const StorePreview = memo(function StorePreview({ item }: { item: SteamStoreItem }) {
  const { colors } = useTheme();
  const { s, width } = useUi();
  const { reduceMotion } = useMotion();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logo = item.logo && item.logo.url !== failedLogo ? item.logo : null;
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 0 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  const maxHeight = s(76);
  const ratio = logo ? logo.width / logo.height : 2.4;
  const logoWidth = Math.min(s(320), width * 0.48, maxHeight * ratio);

  return (
    <Animated.View
      style={{
        maxWidth: s(448),
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <T size={9.3} weight="semibold" color={colors.accentGlow}>Nổi bật trên Steam</T>
      {logo ? (
        <Img
          source={{ uri: logo.url }}
          accessibilityLabel={item.name}
          style={{ width: logoWidth, height: logoWidth / ratio, marginTop: s(6) }}
          contentFit="contain"
          contentPosition="left"
          onError={() => setFailedLogo(logo.url)}
        />
      ) : (
        <T size={Math.min(42, Math.max(25, width * 0.04))} weight="semibold" tracking={-0.05} leading={0.98} numberOfLines={2} style={{ marginTop: s(4) }}>
          {item.name}
        </T>
      )}
      <T size={10.5} color="rgba(255,255,255,0.78)" leading={1.5} numberOfLines={2} style={{ marginTop: s(6), maxWidth: s(560) }}>
        {item.shortDescription
          || item.genres?.slice(0, 3).join(' / ')
          || 'Khám phá game nổi bật, ưu đãi mới và các trò chơi bán chạy trên Steam.'}
      </T>
    </Animated.View>
  );
});

const ShelfCard = memo(function ShelfCard({ item, previewing, onPreview, onOpen }: {
  item: SteamStoreItem;
  previewing: boolean;
  onPreview: (item: SteamStoreItem) => void;
  onOpen: (item: SteamStoreItem) => void;
}) {
  const { colors, glass, id } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const preview = useCallback(() => onPreview(item), [item, onPreview]);
  const open = useCallback(() => onOpen(item), [item, onOpen]);
  const { reduceMotion } = useMotion();
  const previousPreview = useRef(previewing);
  const [selection] = useState(() => new Animated.Value(previewing ? 1 : 0));
  useEffect(() => {
    const changed = previousPreview.current !== previewing;
    previousPreview.current = previewing;
    if (reduceMotion) { selection.setValue(previewing ? 1 : 0); return; }
    if (!changed) return;
    const animation = Animated.spring(selection, {
      toValue: previewing ? 1 : 0,
      stiffness: 260,
      damping: 26,
      mass: 0.72,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [previewing, reduceMotion, selection]);

  return (
    <View>
      <Press onPress={preview} onFocused={preview} autoFocus={previewing} focusRadius={s(previewing ? 20 : 12)} pressScale={0.98} accessibilityLabel={`Chọn ${item.name}`}>
        <Animated.View
          style={[
            styles.card,
            {
              borderRadius: s(previewing ? 20 : 12),
              width: s(previewing ? PREVIEW.w : IDLE.w),
              height: s(previewing ? PREVIEW.h : IDLE.h),
              marginBottom: previewing ? 0 : s(4),
              borderColor: previewing ? glass.cardBorderActive : glass.cardBorder,
              opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
              transform: [
                { scale: selection.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
                { translateY: selection.interpolate({ inputRange: [0, 1], outputRange: [s(2), 0] }) },
              ],
            },
          ]}
        >
          <Img source={{ uri: item.largeImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <CardSurface selected={previewing} radius={s(previewing ? 20 : 12)} />
          {previewing ? (
            <>
              <View pointerEvents="none" style={styles.selectedWash} />
              <View pointerEvents="none" style={[styles.badgeSlot, { top: s(10), left: s(10), gap: s(5) }]}>
                {item.discounted ? (
                  <View style={[styles.saleBadge, { minHeight: s(24), paddingHorizontal: s(8), borderRadius: s(12) }]}>
                    <T size={9.2} weight="bold" color="#ffffff" tabular>-{item.discountPercent}%</T>
                  </View>
                ) : null}
                <View style={[styles.badge, { minHeight: s(24), paddingHorizontal: s(9), borderRadius: s(12) }]}>
                  <T size={9.2} weight="semibold" color="rgba(255,255,255,0.98)" tabular>
                    {formatStorePrice(item)}
                  </T>
                </View>
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: s(SHELF_BLOCK),
                  height: s(SHELF_BLOCK),
                  borderTopLeftRadius: s(SHELF_BLOCK - SHELF_DISC / 2),
                  backgroundColor: id === 'console' ? '#060b13' : colors.bgDeep,
                }}
              />
              <NotchFillet bottom={SHELF_BLOCK} right={0} />
              <NotchFillet bottom={0} right={SHELF_BLOCK} />
            </>
          ) : (
            <>
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: s(8), flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(8) }}>
                <T size={9.3} weight="semibold" color="rgba(255,255,255,0.92)" numberOfLines={1} style={{ flex: 1 }}>{item.name}</T>
                {item.discounted ? <DiscountBadge percent={item.discountPercent} size={8.3} /> : null}
              </View>
            </>
          )}
        </Animated.View>
      </Press>
      {previewing ? (
        <Press
          onPress={open}
          accessibilityLabel={`Xem chi tiết ${item.name}`}
          focusRadius={s(SHELF_DISC / 2)}
          style={[styles.openButton, { width: s(SHELF_DISC), height: s(SHELF_DISC), borderRadius: s(SHELF_DISC / 2) }]}
        >
          <ArrowUpRight size={s(17)} color={colors.white} strokeWidth={1.9} />
        </Press>
      ) : null}
    </View>
  );
});

const PromotionTile = memo(function PromotionTile({ promotion, onOpen }: { promotion: SteamPromotion; onOpen: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  return (
    <Press onPress={onOpen} pressScale={0.99} accessibilityLabel={`Xem khuyến mãi ${promotion.name}`} style={[styles.tile, { flex: 1.25, borderRadius: s(12) }]}>
      <Img source={{ uri: promotion.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={[alpha(colors.panelSolid, 0.94), alpha(colors.panelSolid, 0.48), alpha(colors.panelSolid, 0)]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, maxWidth: '72%', justifyContent: 'center', padding: s(10) }}>
        <T size={10.2} weight="semibold" leading={1.15} numberOfLines={2}>{promotion.name}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: s(4) }}>
          <T size={8.6} weight="medium" color="rgba(255,255,255,0.82)">Xem khuyến mãi</T>
          <ChevronRight size={s(10)} color="rgba(255,255,255,0.82)" strokeWidth={1.8} />
        </View>
      </View>
    </Press>
  );
});

const QuickDealTile = memo(function QuickDealTile({ item, previewing, onPreview }: { item: SteamStoreItem; previewing: boolean; onPreview: (item: SteamStoreItem) => void }) {
  const { colors, glass } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const preview = useCallback(() => onPreview(item), [item, onPreview]);
  return (
    <Press
      onPress={preview}
      onFocused={preview}
      pressScale={0.99}
      accessibilityLabel={`Chọn ${item.name}`}
      style={[styles.tile, { flex: 1, borderRadius: s(12), borderColor: previewing ? glass.cardBorderActive : glass.cardBorder }]}
    >
      <Img source={{ uri: item.largeImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={[alpha(colors.panelSolid, 0.84), alpha(colors.panelSolid, 0.24), alpha(colors.panelSolid, 0)]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, maxWidth: '72%', justifyContent: 'center', padding: s(10) }}>
        <T size={9.3} weight="semibold" color="rgba(255,255,255,0.92)" numberOfLines={1}>{item.name}</T>
        <T size={8.6} weight="semibold" color={item.discounted ? colors.accentGlow : 'rgba(255,255,255,0.78)'} style={{ marginTop: s(4) }}>
          {item.discounted ? `Giảm ${item.discountPercent}%` : formatStorePrice(item)}
        </T>
      </View>
    </Press>
  );
});

/** Trang chủ tab Store: game nổi bật, kệ bán chạy và hàng ưu đãi. */
export const StoreHome = memo(function StoreHome({ data, featured, preview, onPreview, onOpenGame, onOpenPromotion }: {
  data: StoreResponse;
  featured: SteamStoreItem;
  preview: SteamStoreItem;
  onPreview: (item: SteamStoreItem) => void;
  onOpenGame: (item: SteamStoreItem) => void;
  onOpenPromotion: (promotion: SteamPromotion) => void;
}) {
  const { s } = useUi();
  const rail = useRef<ScrollView>(null);
  const railWidth = useRef(0);
  const shelfItems = useMemo(() => Array.from(
    new Map([featured, ...(data.topSellers || []), ...(data.newReleases || [])].map((item) => [item.appId, item])).values(),
  ).slice(0, 7), [data.topSellers, data.newReleases, featured]);
  const quickItems = useMemo(() => (data.specials || []).filter((item) => item.appId !== featured.appId).slice(0, 3), [data.specials, featured.appId]);
  const promotion = data.promotions?.[0];
  const previewIndex = Math.max(0, shelfItems.findIndex((item) => item.appId === preview.appId));
  const preloadUrls = useMemo(() => nearbyBackdropUrls(
    shelfItems.map((item) => item.backgroundImage || `https://shared.steamstatic.com/store_item_assets/steam/apps/${item.appId}/library_hero.jpg`),
    previewIndex,
  ), [shelfItems, previewIndex]);
  useBackdropPreload(preloadUrls);

  const center = useCallback((animated: boolean) => {
    const left = previewIndex * (s(IDLE.w) + s(GAP));
    rail.current?.scrollTo({ x: Math.max(0, left - (railWidth.current - s(PREVIEW.w)) / 2), animated });
  }, [previewIndex, s]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => center(true));
    return () => cancelAnimationFrame(frame);
  }, [center]);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', overflow: 'hidden', paddingBottom: s(2), paddingTop: s(4) }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: s(6) }}>
        <StorePreview item={preview} />
      </View>

      <FocusScroll
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => { railWidth.current = event.nativeEvent.layout.width; center(false); }}
        style={{ flexGrow: 0, height: s(PREVIEW.h + 40) }}
        contentContainerStyle={{ alignItems: 'flex-end', gap: s(GAP), paddingHorizontal: s(10), paddingTop: s(22), paddingBottom: s(12) }}
        decelerationRate="fast"
      >
        {shelfItems.map((item) => (
          <ShelfCard
            key={item.appId}
            item={item}
            previewing={preview.appId === item.appId}
            onPreview={onPreview}
            onOpen={onOpenGame}
          />
        ))}
        <View style={{ width: s(PREVIEW.w) }} />
      </FocusScroll>

      <View style={{ marginTop: s(8), height: s(70), flexDirection: 'row', gap: s(10) }}>
        {promotion ? <PromotionTile promotion={promotion} onOpen={() => onOpenPromotion(promotion)} /> : null}
        {quickItems.map((item) => (
          <QuickDealTile key={item.appId} item={item} previewing={preview.appId === item.appId} onPreview={onPreview} />
        ))}
      </View>
    </View>
  );
});

const useStyles = makeStyles(({ colors, glass }) => ({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: alpha(colors.card, 0.85),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  tile: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.cardBorder,
    backgroundColor: alpha(colors.card, 0.82),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  selectedWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: alpha(colors.bgDeep, 0.12),
  },
  badgeSlot: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.primary, 0.48),
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.75),
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: glass.panel,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  openButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.floatingBar,
    borderWidth: 1,
    borderColor: glass.controlBorder,
    shadowColor: colors.bgDeep,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
}));
