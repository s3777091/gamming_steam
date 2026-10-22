import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, ChevronRight } from 'lucide-react-native';

import { FocusScroll, useSceneActive } from '@/features/gamepad/focus';
import { formatStorePrice } from '@/features/library/format';
import type { SteamPromotion, SteamStoreItem, StoreResponse } from '@/features/library/types';
import { nearbyBackdropUrls } from '@/lib/backdrop-preloader';
import { Img } from '@/ui/Img';
import { useBackdropPreload } from '@/ui/useBackdropPreload';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ConsoleAction, ConsoleHints } from './ConsoleControls';
import { CONSOLE, CONSOLE_CARD } from './consoleVisuals';
import { useConsoleRailScroll } from './useConsoleRailScroll';

const GAP = 12;

function DiscountBadge({ percent }: { percent: number }) {
  const { s } = useUi();
  return (
    <View style={{ backgroundColor: CONSOLE.navigationSelected, borderRadius: s(6), paddingHorizontal: s(7),
      paddingVertical: s(3), borderWidth: 1, borderColor: CONSOLE.navigationSelectedBorder }}>
      <T size={9} weight="semibold" color={CONSOLE.ink} tabular>-{percent}%</T>
    </View>
  );
}

const StorePreview = memo(function StorePreview({ item, onOpen }: { item: SteamStoreItem; onOpen: (item: SteamStoreItem) => void }) {
  const { s, width, height } = useUi();
  const { active, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logo = item.logo && item.logo.url !== failedLogo ? item.logo : null;
  const [enter] = useState(() => new Animated.Value(1));
  useLayoutEffect(() => {
    enter.setValue(reduceMotion || !active || !sceneActive ? 1 : 0);
    const animation = Animated.timing(enter, {
      toValue: 1, duration: reduceMotion || !active || !sceneActive ? 0 : CONSOLE.infoMs,
      easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, enter, item.appId, reduceMotion, sceneActive]);

  const ratio = logo && logo.width > 0 && logo.height > 0 ? logo.width / logo.height : 2.4;
  const logoWidth = Math.min(s(292), width * 0.34, Math.min(s(90), height * 0.17) * ratio);
  return (
    <Animated.View style={{ alignItems: 'flex-start', gap: s(10), opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : s(8), 0] }) }] }}>
      {logo ? (
        <Img source={{ uri: logo.url }} accessibilityLabel={item.name} recyclingKey={String(item.appId)} transition={0}
          style={{ width: logoWidth, height: logoWidth / ratio }} contentFit="contain" contentPosition="left" onError={() => setFailedLogo(logo.url)} />
      ) : (
        <T size={Math.min(42, Math.max(28, width * 0.043 / 1.4))} weight="semibold" color={CONSOLE.ink}
          tracking={-0.04} leading={1.1} numberOfLines={2} style={{ maxWidth: s(448) }}>{item.name}</T>
      )}
      <T size={11} color={CONSOLE.muted} leading={1.5} numberOfLines={2} style={{ maxWidth: s(400) }}>
        {item.genres?.length ? item.genres.slice(0, 3).join(' · ') : item.shortDescription || 'Khám phá trên Steam Store'}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), flexWrap: 'wrap' }}>
        <ConsoleAction label="Xem chi tiết" onPress={() => onOpen(item)} autoFocus icon={<ArrowUpRight size={s(18)} color={CONSOLE.ink} />} />
        {item.discounted ? <DiscountBadge percent={item.discountPercent} /> : null}
        <T size={12} weight="semibold" color={CONSOLE.ink} tabular>{formatStorePrice(item)}</T>
      </View>
    </Animated.View>
  );
});

const ShelfCard = memo(function ShelfCard({ item, previewing, onPreview, onOpen }: {
  item: SteamStoreItem;
  previewing: boolean;
  onPreview: (item: SteamStoreItem) => void;
  onOpen: (item: SteamStoreItem) => void;
}) {
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const preview = useCallback(() => onPreview(item), [item, onPreview]);
  const [selection] = useState(() => new Animated.Value(previewing ? 1 : 0));
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const artwork = item.largeImage || item.headerImage || item.smallImage;
  const previous = useRef(previewing);
  useEffect(() => {
    const changed = previous.current !== previewing;
    previous.current = previewing;
    if (reduceMotion || !changed) { selection.setValue(previewing ? 1 : 0); return; }
    const animation = Animated.timing(selection, {
      toValue: previewing ? 1 : 0, duration: CONSOLE.focusMs,
      easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [previewing, reduceMotion, selection]);
  return (
    <Animated.View style={{ width: s(CONSOLE_CARD.width), height: s(CONSOLE_CARD.height),
      transform: [{ scale: selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
      <Press onPress={previewing ? () => onOpen(item) : preview} onFocused={preview}
        focusVariant="quiet" focusScale={1} focusRadius={s(CONSOLE_CARD.radius)} pressScale={0.98}
        accessibilityLabel={item.name} accessibilityState={{ selected: previewing }}
        accessibilityHint={previewing ? 'Nhấn để xem chi tiết game' : 'Nhấn để xem trước game'}
        style={{ flex: 1, borderRadius: s(CONSOLE_CARD.radius) }}>
        <Animated.View style={{ flex: 1, borderRadius: s(CONSOLE_CARD.radius), overflow: 'hidden', borderWidth: 1,
          borderColor: previewing ? CONSOLE.selectedBorder : CONSOLE.border, backgroundColor: CONSOLE.card,
          opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }}>
          {artwork && artwork !== failedArtwork ? (
            <Img source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0}
              recyclingKey={String(item.appId)} onError={() => setFailedArtwork(artwork)} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: s(10) }}>
              <T size={12} weight="semibold" color={CONSOLE.ink} numberOfLines={2}>{item.name}</T>
            </View>
          )}
        </Animated.View>
      </Press>
    </Animated.View>
  );
});

const PromotionTile = memo(function PromotionTile({ promotion, onOpen }: { promotion: SteamPromotion; onOpen: () => void }) {
  const { s } = useUi();
  return (
    <Press onPress={onOpen} focusVariant="quiet" pressScale={0.99} accessibilityLabel={`Xem khuyến mãi ${promotion.name}`}
      style={{ flex: 1.25, borderRadius: s(10), borderWidth: 1, borderColor: CONSOLE.border, backgroundColor: CONSOLE.card }}>
      <Img source={{ uri: promotion.image }} style={[StyleSheet.absoluteFill, { borderRadius: s(10) }]} contentFit="cover" />
      <LinearGradient colors={['rgba(6,11,8,0.94)', 'rgba(6,11,8,0.48)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: s(10) }]} />
      <View style={{ flex: 1, maxWidth: '85%', justifyContent: 'center', padding: s(10) }}>
        <T size={10} weight="semibold" color={CONSOLE.ink} leading={1.2} numberOfLines={1}>{promotion.name}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: s(4) }}>
          <T size={9} color={CONSOLE.muted}>Xem khuyến mãi</T>
          <ChevronRight size={s(10)} color={CONSOLE.muted} strokeWidth={1.8} />
        </View>
      </View>
    </Press>
  );
});

const QuickDealTile = memo(function QuickDealTile({ item, previewing, onPreview, onOpen }: {
  item: SteamStoreItem; previewing: boolean; onPreview: (item: SteamStoreItem) => void; onOpen: (item: SteamStoreItem) => void;
}) {
  const { s } = useUi();
  const preview = useCallback(() => onPreview(item), [item, onPreview]);
  return (
    <Press onPress={previewing ? () => onOpen(item) : preview} onFocused={preview} focusVariant="quiet" pressScale={0.99}
      accessibilityLabel={item.name} accessibilityState={{ selected: previewing }}
      style={{ flex: 1, borderRadius: s(10), borderWidth: 1, borderColor: previewing ? CONSOLE.selectedBorder : CONSOLE.border, backgroundColor: CONSOLE.card }}>
      <Img source={{ uri: item.largeImage }} style={[StyleSheet.absoluteFill, { borderRadius: s(10) }]} contentFit="cover" />
      <LinearGradient colors={['rgba(6,11,8,0.9)', 'rgba(6,11,8,0.35)', 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[StyleSheet.absoluteFill, { borderRadius: s(10) }]} />
      <View style={{ flex: 1, maxWidth: '90%', justifyContent: 'center', padding: s(10) }}>
        <T size={10} weight="semibold" color={CONSOLE.ink} numberOfLines={1}>{item.name}</T>
        <T size={9} color={CONSOLE.muted} numberOfLines={1} style={{ marginTop: s(4) }}>
          {item.discounted ? `Giảm ${item.discountPercent}% · ${formatStorePrice(item)}` : formatStorePrice(item)}
        </T>
      </View>
    </Press>
  );
});

/** Store retains its promotions while sharing the Games hero and carousel language. */
export const StoreHome = memo(function StoreHome({ data, featured, preview, onPreview, onOpenGame, onOpenPromotion }: {
  data: StoreResponse;
  featured: SteamStoreItem;
  preview: SteamStoreItem;
  onPreview: (item: SteamStoreItem) => void;
  onOpenGame: (item: SteamStoreItem) => void;
  onOpenPromotion: (promotion: SteamPromotion) => void;
}) {
  const { s, width } = useUi();
  const rail = useRef<ScrollView>(null);
  const railWidth = useRef(0);
  const scrollTo = useCallback((x: number) => rail.current?.scrollTo({ x, animated: false }), []);
  const { center: scrollCenter, stop, onScroll } = useConsoleRailScroll(scrollTo);
  const shelfItems = useMemo(() => Array.from(
    new Map([featured, ...(data.topSellers || []), ...(data.newReleases || [])].map((item) => [item.appId, item])).values(),
  ).slice(0, 7), [data.topSellers, data.newReleases, featured]);
  const quickItems = useMemo(() => (data.specials || []).filter((item) => item.appId !== featured.appId).slice(0, 3), [data.specials, featured.appId]);
  const promotion = data.promotions?.[0];
  const previewIndex = shelfItems.findIndex((item) => item.appId === preview.appId);
  const preloadUrls = useMemo(() => nearbyBackdropUrls(
    shelfItems.map((item) => item.backgroundImage || `https://shared.steamstatic.com/store_item_assets/steam/apps/${item.appId}/library_hero.jpg`),
    Math.max(0, previewIndex),
  ), [shelfItems, previewIndex]);
  useBackdropPreload(preloadUrls);

  const center = useCallback((animated: boolean) => {
    if (previewIndex < 0 || railWidth.current <= 0) return;
    const left = s(10) + previewIndex * s(CONSOLE_CARD.width + GAP);
    scrollCenter(Math.max(0, left - (railWidth.current - s(CONSOLE_CARD.width)) / 2), animated);
  }, [previewIndex, s, scrollCenter]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => center(true));
    return () => { cancelAnimationFrame(frame); stop(); };
  }, [center, stop]);

  return (
    <View style={{ flex: 1 }}>
      <FocusScroll style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: s(10), paddingTop: s(8), paddingBottom: s(10) }}>
        <StorePreview item={preview} onOpen={onOpenGame} />
      </FocusScroll>
      <FocusScroll ref={rail} horizontal showsHorizontalScrollIndicator={false}
        onLayout={(event) => { railWidth.current = event.nativeEvent.layout.width; center(false); }}
        onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={stop}
        style={{ flexGrow: 0, height: s(CONSOLE_CARD.railHeight) }}
        contentContainerStyle={{ alignItems: 'center', gap: s(GAP), paddingHorizontal: s(10), paddingVertical: s(12) }}
        decelerationRate="fast" accessibilityRole="list">
        {shelfItems.map((item) => <ShelfCard key={item.appId} item={item} previewing={preview.appId === item.appId} onPreview={onPreview} onOpen={onOpenGame} />)}
        <View style={{ width: width / 2 }} />
      </FocusScroll>
      {promotion || quickItems.length ? (
        <View style={{ marginHorizontal: s(10), marginBottom: s(6), height: s(56), flexDirection: 'row', gap: s(10) }}>
          {promotion ? <PromotionTile promotion={promotion} onOpen={() => onOpenPromotion(promotion)} /> : null}
          {quickItems.map((item) => <QuickDealTile key={item.appId} item={item} previewing={preview.appId === item.appId} onPreview={onPreview} onOpen={onOpenGame} />)}
        </View>
      ) : null}
      <ConsoleHints actionLabel="Xem chi tiết" />
    </View>
  );
});
