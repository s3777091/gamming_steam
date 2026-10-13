import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ScrollView } from 'react-native';
import { FocusScroll } from '@/features/gamepad/focus';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Info } from 'lucide-react-native';

import { formatStorePrice } from '@/features/library/format';
import type { SteamPromotion, SteamStoreItem, StoreResponse } from '@/features/library/types';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const PREVIEW = { w: 212, h: 114 };
const IDLE = { w: 125, h: 80 };
const GAP = 10;

function DiscountBadge({ percent, size = 9 }: { percent: number; size?: number }) {
  const { s } = useUi();
  return (
    <View style={{ backgroundColor: colors.accent, borderRadius: s(6), paddingHorizontal: s(6), paddingVertical: s(2) }}>
      <T size={size} weight="bold" color={colors.onAccent} tabular>-{percent}%</T>
    </View>
  );
}

function StorePreview({ item }: { item: SteamStoreItem }) {
  const { s, width } = useUi();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logo = item.logo && item.logo.url !== failedLogo ? item.logo : null;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

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
      <T size={9.3} weight="semibold" color="#9ac5ff">Nổi bật trên Steam</T>
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
      <T size={10.5} color="rgba(255,255,255,0.64)" leading={1.5} numberOfLines={2} style={{ marginTop: s(6), maxWidth: s(560) }}>
        {item.shortDescription
          || item.genres?.slice(0, 3).join(' / ')
          || 'Khám phá game nổi bật, ưu đãi mới và các trò chơi bán chạy trên Steam.'}
      </T>
    </Animated.View>
  );
}

function ShelfCard({ item, previewing, onPreview, onOpen }: {
  item: SteamStoreItem;
  previewing: boolean;
  onPreview: () => void;
  onOpen: () => void;
}) {
  const { s } = useUi();
  const grow = useRef(new Animated.Value(previewing ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: previewing ? 1 : 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [previewing, grow]);

  return (
    <View>
      <Press onPress={onPreview} onFocused={onPreview} autoFocus={previewing} focusRadius={s(12)} pressScale={0.98} accessibilityLabel={`Chọn ${item.name}`}>
        <Animated.View
          style={[
            styles.card,
            {
              borderRadius: s(12),
              width: grow.interpolate({ inputRange: [0, 1], outputRange: [s(IDLE.w), s(PREVIEW.w)] }),
              height: grow.interpolate({ inputRange: [0, 1], outputRange: [s(IDLE.h), s(PREVIEW.h)] }),
              marginBottom: grow.interpolate({ inputRange: [0, 1], outputRange: [s(4), 0] }),
              borderColor: grow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.14)', '#8bbcff'] }),
              opacity: grow.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
            },
          ]}
        >
          <Img source={{ uri: item.largeImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(6,16,29,0)', 'rgba(6,16,29,0.88)']} style={StyleSheet.absoluteFill} />
          {previewing ? (
            <View style={{ position: 'absolute', left: 0, right: s(54), bottom: 0, padding: s(10), gap: s(4) }}>
              <T size={9.6} weight="semibold" color="rgba(255,255,255,0.92)" numberOfLines={1}>{item.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                {item.discounted ? <DiscountBadge percent={item.discountPercent} size={8.6} /> : null}
                <T size={10} weight="semibold" tabular color="rgba(255,255,255,0.88)" numberOfLines={1}>{formatStorePrice(item)}</T>
              </View>
            </View>
          ) : (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: s(8), flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(8) }}>
              <T size={9.3} weight="semibold" color="rgba(255,255,255,0.92)" numberOfLines={1} style={{ flex: 1 }}>{item.name}</T>
              {item.discounted ? <DiscountBadge percent={item.discountPercent} size={8.3} /> : null}
            </View>
          )}
        </Animated.View>
      </Press>
      {previewing ? (
        <Press
          onPress={onOpen}
          accessibilityLabel={`Xem chi tiết ${item.name}`}
          style={[styles.info, { width: s(36), height: s(36), borderRadius: s(18) }]}
        >
          <Info size={s(16)} color={colors.white} strokeWidth={1.9} />
        </Press>
      ) : null}
    </View>
  );
}

function PromotionTile({ promotion, onOpen }: { promotion: SteamPromotion; onOpen: () => void }) {
  const { s } = useUi();
  return (
    <Press onPress={onOpen} pressScale={0.99} accessibilityLabel={`Xem khuyến mãi ${promotion.name}`} style={[styles.tile, { flex: 1.25, borderRadius: s(12) }]}>
      <Img source={{ uri: promotion.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(6,16,29,0.94)', 'rgba(6,16,29,0.48)', 'rgba(6,16,29,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, maxWidth: '72%', justifyContent: 'center', padding: s(10) }}>
        <T size={10.2} weight="semibold" leading={1.15} numberOfLines={2}>{promotion.name}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: s(4) }}>
          <T size={8.6} weight="medium" color="rgba(255,255,255,0.58)">Xem khuyến mãi</T>
          <ChevronRight size={s(10)} color="rgba(255,255,255,0.58)" strokeWidth={1.8} />
        </View>
      </View>
    </Press>
  );
}

function QuickDealTile({ item, previewing, onPreview }: { item: SteamStoreItem; previewing: boolean; onPreview: () => void }) {
  const { s } = useUi();
  return (
    <Press
      onPress={onPreview}
      onFocused={onPreview}
      pressScale={0.99}
      accessibilityLabel={`Chọn ${item.name}`}
      style={[styles.tile, { flex: 1, borderRadius: s(12), borderColor: previewing ? '#9ac5ff' : 'rgba(255,255,255,0.12)' }]}
    >
      <Img source={{ uri: item.largeImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(6,16,29,0.84)', 'rgba(6,16,29,0.24)', 'rgba(6,16,29,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, maxWidth: '72%', justifyContent: 'center', padding: s(10) }}>
        <T size={9.3} weight="semibold" color="rgba(255,255,255,0.92)" numberOfLines={1}>{item.name}</T>
        <T size={8.6} weight="medium" color="rgba(255,255,255,0.56)" style={{ marginTop: s(4) }}>
          {item.discounted ? `Giảm ${item.discountPercent}%` : formatStorePrice(item)}
        </T>
      </View>
    </Press>
  );
}

/** Trang chủ tab Store: game nổi bật, kệ bán chạy và hàng ưu đãi. */
export function StoreHome({ data, featured, preview, onPreview, onOpenGame, onOpenPromotion }: {
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
  const shelfItems = Array.from(
    new Map([featured, ...(data.topSellers || []), ...(data.newReleases || [])].map((item) => [item.appId, item])).values(),
  ).slice(0, 7);
  const quickItems = (data.specials || []).filter((item) => item.appId !== featured.appId).slice(0, 3);
  const promotion = data.promotions?.[0];
  const previewIndex = Math.max(0, shelfItems.findIndex((item) => item.appId === preview.appId));

  const center = (animated: boolean) => {
    const left = previewIndex * (s(IDLE.w) + s(GAP));
    rail.current?.scrollTo({ x: Math.max(0, left - (railWidth.current - s(PREVIEW.w)) / 2), animated });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => center(true));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.appId]);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', overflow: 'hidden', paddingBottom: s(2), paddingTop: s(4) }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: s(10) }}>
        <StorePreview key={preview.appId} item={preview} />
      </View>

      <FocusScroll
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => { railWidth.current = event.nativeEvent.layout.width; center(false); }}
        style={{ flexGrow: 0, height: s(138) }}
        contentContainerStyle={{ alignItems: 'flex-end', gap: s(GAP), paddingHorizontal: s(10), paddingTop: s(10), paddingBottom: s(12) }}
        decelerationRate="fast"
      >
        {shelfItems.map((item) => (
          <ShelfCard
            key={item.appId}
            item={item}
            previewing={preview.appId === item.appId}
            onPreview={() => onPreview(item)}
            onOpen={() => onOpenGame(item)}
          />
        ))}
        <View style={{ width: s(PREVIEW.w) }} />
      </FocusScroll>

      <View style={{ marginTop: s(8), height: s(70), flexDirection: 'row', gap: s(10) }}>
        {promotion ? <PromotionTile promotion={promotion} onOpen={() => onOpenPromotion(promotion)} /> : null}
        {quickItems.map((item) => (
          <QuickDealTile key={item.appId} item={item} previewing={preview.appId === item.appId} onPreview={() => onPreview(item)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: 1, backgroundColor: colors.card },
  tile: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: colors.card },
  info: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: colors.cardRaised,
    shadowColor: '#020812',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
