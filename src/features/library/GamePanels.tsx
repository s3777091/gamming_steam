// Ngăn kéo chi tiết game phong cách Apple: Thông tin game, Bản cập nhật & bản sửa lỗi, Thành tựu.
// Thiết kế tối giản, sạch sẽ, chuẩn mực giao diện Apple (SF typography, squircle, inset grouped specs, glance metrics).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  HardDrive,
  Hash,
  Info,
  Layers,
  LockKeyhole,
  Monitor,
  Newspaper,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';

import { useGamepadTabs } from '@/features/gamepad/hooks';
import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { TimedCache } from '@/lib/timed-cache';
import { colors, glass } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { PanelMessage, SidePanel, SteamLink } from '@/ui/SidePanel';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { cleanSteamText, extractSteamImage, formatShortDate, formatSize, isSteamAppId } from './format';
import type { AchievementResponse, NewsResponse, PcGame, SteamAchievement, SteamNewsItem } from './types';
import { useCachedResource } from './useCachedResource';

export type GameDetailTab = 'info' | 'news' | 'achievements';

type DetailTabItem = {
  id: GameDetailTab;
  label: string;
  icon: LucideIcon;
  badge?: string | number | null;
};

const newsCache = { current: new TimedCache<number, NewsResponse>(32, 5 * 60_000) };

function fetchNews(appId: number, signal: AbortSignal) {
  return pcFetchJson<NewsResponse>(
    PC_ROUTES.gameNews(appId),
    'Không tải được thông tin cập nhật từ Steam.',
    (body) => Array.isArray(body.items),
    signal,
  );
}

// ============================================================================
// APPLE SEGMENTED CONTROL (Thanh chuyển tab phong cách Apple iOS 18)
// ============================================================================

function AppleTabItem({
  tab,
  active,
  onPress,
}: {
  tab: DetailTabItem;
  active: boolean;
  onPress: () => void;
}) {
  const { s } = useUi();
  const [activeAnim] = useState(() => new Animated.Value(active ? 1 : 0));
  const Icon = tab.icon;

  useEffect(() => {
    const animation = Animated.timing(activeAnim, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, activeAnim]);

  return (
    <Press
      onPress={onPress}
      onFocused={onPress}
      requestFocus={active}
      autoFocus={active}
      pressScale={0.985}
      sound="focus"
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: s(7),
        paddingHorizontal: s(8),
        borderRadius: s(9),
        gap: s(6),
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: s(9),
            backgroundColor: glass.controlActive,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: glass.controlBorderActive,
            opacity: activeAnim,
            transform: [{ scale: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          },
        ]}
      />
      <Icon
        size={s(13)}
        color={active ? colors.white : colors.text3}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <T
        size={11.5}
        weight={active ? 'semibold' : 'medium'}
        color={active ? colors.white : colors.text2}
        numberOfLines={1}
      >
        {tab.label}
      </T>
      {tab.badge != null ? (
        <View
          style={{
            paddingHorizontal: s(5),
            paddingVertical: s(1),
            borderRadius: s(6),
            backgroundColor: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <T size={9.5} weight="bold" color={active ? colors.white : colors.text3} tabular>
            {String(tab.badge)}
          </T>
        </View>
      ) : null}
    </Press>
  );
}

function PanelTabContent({ children }: { children: ReactNode }) {
  const { s } = useUi();
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 190,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter]);

  return (
    <Animated.View
      style={{
        opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [s(4), 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function AppleTabBar({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: DetailTabItem[];
  activeTab: GameDetailTab;
  onSelectTab: (tab: GameDetailTab) => void;
}) {
  const { s } = useUi();
  return (
    <View
      style={{
        paddingHorizontal: s(16),
        paddingTop: s(8),
        paddingBottom: s(10),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: glass.borderSubtle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: glass.control,
          borderRadius: s(12),
          padding: s(3),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: glass.controlBorder,
          gap: s(4),
        }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <AppleTabItem
              key={tab.id}
              tab={tab}
              active={active}
              onPress={() => onSelectTab(tab.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ============================================================================
// TAB 1: THÔNG TIN GAME (Phong cách Apple App Store / Inset Grouped)
// ============================================================================

function InfoGlanceCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  const { s } = useUi();
  return (
    <View
      style={{
        flex: 1,
        minWidth: s(80),
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: s(10),
        paddingHorizontal: s(6),
        borderRadius: s(12),
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <T size={8.5} weight="bold" color="rgba(255,255,255,0.42)" tracking={0.06} numberOfLines={1}>
        {label.toUpperCase()}
      </T>
      <T size={13.5} weight="bold" color="#ffffff" numberOfLines={1} tabular style={{ marginTop: s(3) }}>
        {value}
      </T>
      {caption ? (
        <T size={9} color="rgba(255,255,255,0.36)" numberOfLines={1} style={{ marginTop: s(2) }}>
          {caption}
        </T>
      ) : null}
    </View>
  );
}

function InsetSpecRow({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  isLast,
}: {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const { s } = useUi();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: s(10),
        paddingHorizontal: s(14),
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        gap: s(12),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), flexShrink: 0 }}>
        <View
          style={{
            width: s(26),
            height: s(26),
            borderRadius: s(7),
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={s(14)} color={iconColor} strokeWidth={2} />
        </View>
        <T size={11.5} color="rgba(255,255,255,0.55)">
          {label}
        </T>
      </View>
      <T
        size={11.5}
        weight="medium"
        color="#ffffff"
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'right' }}
      >
        {value}
      </T>
    </View>
  );
}

function GameInfoView({ game }: { game: PcGame }) {
  const { s } = useUi();
  const [descExpanded, setDescExpanded] = useState(false);

  const cleanDescription = useMemo(() => {
    return cleanSteamText(game.description);
  }, [game.description]);

  const primaryGenre = game.genres?.[0] || 'Game';
  const sizeText = formatSize(game.sizeBytes) || '—';
  const releaseYear = game.releaseDate ? game.releaseDate.replace(/.*?(\d{4}).*$/, '$1') : '—';
  const isInstalled = game.installed !== false;

  const specs = [
    game.developer && {
      icon: Code2,
      iconColor: '#60a5fa',
      iconBg: 'rgba(59,130,246,0.16)',
      label: 'Nhà phát triển',
      value: game.developer,
    },
    game.publisher && {
      icon: Building2,
      iconColor: '#c084fc',
      iconBg: 'rgba(168,85,247,0.16)',
      label: 'Nhà phát hành',
      value: game.publisher,
    },
    game.genres?.length && {
      icon: Layers,
      iconColor: '#fbbf24',
      iconBg: 'rgba(245,158,11,0.16)',
      label: 'Thể loại',
      value: game.genres.join(', '),
    },
    game.releaseDate && {
      icon: Calendar,
      iconColor: '#2dd4bf',
      iconBg: 'rgba(20,184,166,0.16)',
      label: 'Ngày phát hành',
      value: game.releaseDate,
    },
    game.sizeBytes && {
      icon: HardDrive,
      iconColor: '#fb7185',
      iconBg: 'rgba(244,63,94,0.16)',
      label: 'Dung lượng ổ đĩa',
      value: sizeText,
    },
    {
      icon: Monitor,
      iconColor: '#38bdf8',
      iconBg: 'rgba(6,182,212,0.16)',
      label: 'Nền tảng',
      value: 'Windows PC',
    },
    game.steamAppId && {
      icon: Hash,
      iconColor: '#cbd5e1',
      iconBg: 'rgba(148,163,184,0.16)',
      label: 'Steam App ID',
      value: `#${game.steamAppId}`,
    },
    {
      icon: CheckCircle2,
      iconColor: isInstalled ? '#34d399' : '#94a3b8',
      iconBg: isInstalled ? 'rgba(16,185,129,0.16)' : 'rgba(148,163,184,0.12)',
      label: 'Trạng thái',
      value: isInstalled ? 'Đã cài trên máy tính' : 'Chưa cài đặt',
    },
  ].filter(Boolean) as {
    icon: LucideIcon;
    iconColor: string;
    iconBg: string;
    label: string;
    value: string;
  }[];

  return (
    <View style={{ gap: s(14) }}>
      {/* 1. Header Identity Block */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(14),
          padding: s(14),
          borderRadius: s(16),
          backgroundColor: 'rgba(255,255,255,0.035)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <View
          style={{
            width: s(64),
            height: s(64),
            borderRadius: s(16),
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          {game.artworkUrl || game.heroUrl ? (
            <Img
              source={{ uri: game.artworkUrl || game.heroUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={s(28)} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16.5} weight="bold" color="#ffffff" leading={1.25} numberOfLines={2}>
            {game.title}
          </T>
          <T size={11} color="rgba(255,255,255,0.5)" numberOfLines={1} style={{ marginTop: s(3) }}>
            {game.developer || game.publisher || 'Steam Game'}
          </T>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(6) }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(5),
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(10),
                backgroundColor: isInstalled ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.12)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isInstalled ? 'rgba(52,199,89,0.28)' : 'rgba(0,122,255,0.28)',
              }}
            >
              <View
                style={{
                  width: s(5),
                  height: s(5),
                  borderRadius: s(2.5),
                  backgroundColor: isInstalled ? '#34c759' : '#0a84ff',
                }}
              />
              <T size={10} weight="semibold" color={isInstalled ? '#34c759' : '#0a84ff'}>
                {isInstalled ? 'Đã cài trên PC' : 'Chưa cài'}
              </T>
            </View>

            <View
              style={{
                paddingHorizontal: s(7),
                paddingVertical: s(3),
                borderRadius: s(10),
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <T size={9.5} weight="medium" color="rgba(255,255,255,0.6)">
                {game.source || 'Steam'}
              </T>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Glance Metrics Row */}
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        <InfoGlanceCard label="Dung lượng" value={sizeText} caption="Ổ đĩa" />
        <InfoGlanceCard label="Thể loại" value={primaryGenre} caption={game.genres?.[1] || undefined} />
        <InfoGlanceCard label="Ra mắt" value={releaseYear} caption="Năm" />
        <InfoGlanceCard
          label="Mã Game"
          value={game.steamAppId ? `#${game.steamAppId}` : 'PC'}
          caption={game.source || 'Steam'}
        />
      </View>

      {/* 3. Inset Grouped Specs Table */}
      <View
        style={{
          borderRadius: s(16),
          backgroundColor: 'rgba(255,255,255,0.035)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            paddingHorizontal: s(14),
            paddingTop: s(12),
            paddingBottom: s(6),
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <T size={11} weight="semibold" color="rgba(255,255,255,0.4)" tracking={0.04}>
            THÔNG TIN CHI TIẾT
          </T>
        </View>
        {specs.map((spec, index) => (
          <InsetSpecRow
            key={spec.label}
            icon={spec.icon}
            iconColor={spec.iconColor}
            iconBg={spec.iconBg}
            label={spec.label}
            value={spec.value}
            isLast={index === specs.length - 1}
          />
        ))}
      </View>

      {/* 4. Giới thiệu Section */}
      {cleanDescription ? (
        <View
          style={{
            borderRadius: s(16),
            backgroundColor: 'rgba(255,255,255,0.035)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.08)',
            padding: s(14),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(8) }}>
            <T size={12} weight="semibold" color="rgba(255,255,255,0.4)" tracking={0.04}>
              GIỚI THIỆU
            </T>
            {cleanDescription.length > 220 ? (
              <Press
                onPress={() => setDescExpanded(!descExpanded)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}
              >
                <T size={11} weight="medium" color="#60a5fa">
                  {descExpanded ? 'Thu gọn' : 'Xem thêm'}
                </T>
                {descExpanded ? (
                  <ChevronUp size={s(13)} color="#60a5fa" strokeWidth={2} />
                ) : (
                  <ChevronDown size={s(13)} color="#60a5fa" strokeWidth={2} />
                )}
              </Press>
            ) : null}
          </View>

          <T
            size={11.5}
            color="rgba(255,255,255,0.78)"
            leading={1.6}
            numberOfLines={descExpanded ? undefined : 4}
          >
            {cleanDescription}
          </T>
        </View>
      ) : null}

      {/* 5. Apple Store Button */}
      {game.storeUrl ? (
        <SteamLink href={game.storeUrl} style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          Xem trên Steam Store
        </SteamLink>
      ) : null}
    </View>
  );
}

// ============================================================================
// TAB 2: CẬP NHẬT & BẢN SỬA LỖI (Sửa triệt để lỗi [img src=" + phong cách Apple)
// ============================================================================

function NewsArticleView({ item, onBack }: { item: SteamNewsItem; onBack: () => void }) {
  const { s } = useUi();
  const title = cleanSteamText(item.title) || item.title || 'Cập nhật';
  const summary = cleanSteamText(item.summary) || 'Bài cập nhật này chưa có nội dung tóm tắt.';
  const previewImage = item.imageUrl || extractSteamImage(item.summary);
  const dateFormatted = formatShortDate(item.publishedAt);

  return (
    <View style={{ gap: s(12) }}>
      <Press
        onPress={onBack}
        pressScale={0.98}
        sound="back"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
          paddingVertical: s(6),
          alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={s(14)} color="rgba(255,255,255,0.6)" strokeWidth={2} />
        <T size={11.5} weight="medium" color="rgba(255,255,255,0.6)">
          Tất cả cập nhật
        </T>
      </Press>

      {previewImage ? (
        <View
          style={{
            width: '100%',
            height: s(160),
            borderRadius: s(16),
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <Img source={{ uri: previewImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
      ) : null}

      <View
        style={{
          padding: s(16),
          borderRadius: s(16),
          backgroundColor: 'rgba(255,255,255,0.035)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          gap: s(10),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flexWrap: 'wrap' }}>
          {item.feedLabel ? (
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(8),
                backgroundColor: 'rgba(96,165,250,0.14)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(96,165,250,0.25)',
              }}
            >
              <T size={9.5} weight="bold" color="#60a5fa">
                {cleanSteamText(item.feedLabel).toUpperCase() || 'BẢN CẬP NHẬT'}
              </T>
            </View>
          ) : null}
          {dateFormatted ? (
            <T size={10} color="rgba(255,255,255,0.4)" tabular>
              {dateFormatted}
            </T>
          ) : null}
          {item.author ? (
            <T size={10} color="rgba(255,255,255,0.4)">
              bởi {cleanSteamText(item.author)}
            </T>
          ) : null}
        </View>

        <T size={16} weight="bold" color="#ffffff" leading={1.3} tracking={-0.02}>
          {title}
        </T>

        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: s(4) }} />

        <T size={12} color="rgba(255,255,255,0.8)" leading={1.7}>
          {summary}
        </T>

        {item.url ? (
          <SteamLink href={item.url} style={{ marginTop: s(8), alignSelf: 'stretch', justifyContent: 'center' }}>
            Mở bài viết đầy đủ trên Steam
          </SteamLink>
        ) : null}
      </View>
    </View>
  );
}

function NewsCardItem({ item, onOpen }: { item: SteamNewsItem; onOpen: () => void }) {
  const { s } = useUi();
  const title = cleanSteamText(item.title) || item.title || 'Cập nhật';
  const summary = cleanSteamText(item.summary);
  const previewImage = item.imageUrl || extractSteamImage(item.summary);
  const dateFormatted = formatShortDate(item.publishedAt);

  return (
    <Press
      onPress={onOpen}
      pressScale={0.99}
      sound="focus"
      style={{
        padding: s(13),
        borderRadius: s(14),
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: s(8),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), flex: 1, minWidth: 0 }}>
          <View
            style={{
              paddingHorizontal: s(6),
              paddingVertical: s(2),
              borderRadius: s(6),
              backgroundColor: 'rgba(96,165,250,0.12)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(96,165,250,0.22)',
            }}
          >
            <T size={9} weight="bold" color="#60a5fa" numberOfLines={1}>
              {cleanSteamText(item.feedLabel).toUpperCase() || 'BẢN VÁ'}
            </T>
          </View>
          {dateFormatted ? (
            <T size={9.5} color="rgba(255,255,255,0.4)" tabular>
              {dateFormatted}
            </T>
          ) : null}
        </View>

        <ChevronRight size={s(15)} color="rgba(255,255,255,0.35)" strokeWidth={2} />
      </View>

      <View style={{ flexDirection: 'row', gap: s(10), alignItems: 'flex-start' }}>
        {previewImage ? (
          <View
            style={{
              width: s(52),
              height: s(52),
              borderRadius: s(10),
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
          >
            <Img source={{ uri: previewImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </View>
        ) : null}

        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={12.5} weight="semibold" color="#ffffff" leading={1.35} numberOfLines={2}>
            {title}
          </T>
          {summary ? (
            <T
              size={11}
              color="rgba(255,255,255,0.55)"
              leading={1.45}
              numberOfLines={previewImage ? 2 : 3}
              style={{ marginTop: s(4) }}
            >
              {summary}
            </T>
          ) : null}
        </View>
      </View>
    </Press>
  );
}

function GameNewsView({ appId }: { appId: number }) {
  const { s } = useUi();
  const news = useCachedResource(appId, newsCache, fetchNews, 'Không tải được thông tin cập nhật từ Steam.');
  const [openItem, setOpenItem] = useState<SteamNewsItem | null>(null);
  const items = news.data?.items || [];

  if (news.loading) {
    return <ListSkeleton rows={4} />;
  }
  if (news.error) {
    return <PanelMessage icon={Newspaper} message={news.error} />;
  }
  if (openItem) {
    return <NewsArticleView item={openItem} onBack={() => setOpenItem(null)} />;
  }
  if (items.length === 0) {
    return <PanelMessage icon={Newspaper} message="Steam chưa đăng bài cập nhật hoặc bản vá cho game này." />;
  }

  return (
    <View style={{ gap: s(8) }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: s(4),
          paddingHorizontal: s(2),
        }}
      >
        <T size={11} weight="semibold" color="rgba(255,255,255,0.4)" tracking={0.04}>
          LỊCH SỬ BẢN VÁ & CẬP NHẬT
        </T>
        <T size={10} color="rgba(255,255,255,0.4)" tabular>
          {items.length} bài viết
        </T>
      </View>

      {items.map((item) => (
        <NewsCardItem key={item.id} item={item} onOpen={() => setOpenItem(item)} />
      ))}
    </View>
  );
}

// ============================================================================
// TAB 3: THÀNH TỰU (Phong cách Apple Game Center)
// ============================================================================

function AchievementRowItem({ achievement }: { achievement: SteamAchievement }) {
  const { s } = useUi();
  const unlockedAt = formatShortDate(achievement.unlockTime);
  const isUnlocked = Boolean(achievement.unlocked);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: s(10),
        borderRadius: s(12),
        gap: s(12),
        backgroundColor: isUnlocked ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.035)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isUnlocked ? 'rgba(96,165,250,0.24)' : 'rgba(255,255,255,0.07)',
      }}
    >
      <View
        style={{
          width: s(44),
          height: s(44),
          borderRadius: s(10),
          overflow: 'hidden',
          backgroundColor: isUnlocked ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isUnlocked ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)',
        }}
      >
        {achievement.iconUrl ? (
          <Img
            source={{ uri: achievement.iconUrl }}
            style={{ width: '100%', height: '100%', opacity: isUnlocked ? 1 : 0.45 }}
            contentFit="cover"
          />
        ) : isUnlocked ? (
          <Trophy size={s(20)} color="#60a5fa" />
        ) : (
          <LockKeyhole size={s(16)} color="rgba(255,255,255,0.3)" />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) }}>
          <T
            size={12}
            weight="semibold"
            color={isUnlocked ? '#ffffff' : 'rgba(255,255,255,0.65)'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {achievement.name}
          </T>
          {unlockedAt ? (
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(1.5),
                borderRadius: s(6),
                backgroundColor: 'rgba(59,130,246,0.18)',
              }}
            >
              <T size={9} weight="medium" color="#93c5fd" tabular>
                {unlockedAt}
              </T>
            </View>
          ) : null}
        </View>

        <T
          size={10.5}
          color={isUnlocked ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)'}
          leading={1.35}
          numberOfLines={2}
          style={{ marginTop: s(2) }}
        >
          {achievement.description || (achievement.hidden ? 'Thành tựu ẩn' : 'Chưa có mô tả')}
        </T>
      </View>
    </View>
  );
}

function GameAchievementsView({
  data,
  loading,
  error,
}: {
  data: AchievementResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const { s } = useUi();
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const allList = useMemo(() => data?.achievements || [], [data?.achievements]);
  const total = data?.total || allList.length;
  const unlocked = data?.unlocked || allList.filter((a) => a.unlocked).length;
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  const filtered = useMemo(() => {
    if (filter === 'unlocked') return allList.filter((a) => a.unlocked);
    if (filter === 'locked') return allList.filter((a) => !a.unlocked);
    return allList;
  }, [allList, filter]);

  if (loading) {
    return <ListSkeleton rows={4} />;
  }
  if (error) {
    return (
      <PanelMessage
        icon={LockKeyhole}
        message={error}
        hint="Trong Steam, hãy đặt Game details thành Public rồi thử lại."
      />
    );
  }
  if (data && !data.supported) {
    return <PanelMessage icon={Trophy} message="Trò chơi này không hỗ trợ Steam Achievements." />;
  }

  return (
    <View style={{ gap: s(12) }}>
      {/* Game Center Progress Banner */}
      <View
        style={{
          padding: s(14),
          borderRadius: s(16),
          backgroundColor: 'rgba(255,255,255,0.035)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.08)',
          gap: s(10),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <View
              style={{
                width: s(32),
                height: s(32),
                borderRadius: s(8),
                backgroundColor: 'rgba(245,158,11,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={s(17)} color="#fbbf24" />
            </View>
            <View>
              <T size={12.5} weight="bold" color="#ffffff">
                Tiến trình thành tựu
              </T>
              <T size={10} color="rgba(255,255,255,0.45)">
                Đã mở {unlocked} / {total}
              </T>
            </View>
          </View>

          <T size={16} weight="bold" color="#60a5fa" tabular>
            {percent}%
          </T>
        </View>

        {/* Progress Bar */}
        <View
          style={{
            height: s(6),
            borderRadius: s(3),
            backgroundColor: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${percent}%`,
              borderRadius: s(3),
              backgroundColor: '#3b82f6',
            }}
          />
        </View>

        {/* Filter Pills */}
        <View style={{ flexDirection: 'row', gap: s(6), marginTop: s(2) }}>
          {(
            [
              { id: 'all', label: `Tất cả (${total})` },
              { id: 'unlocked', label: `Đã mở (${unlocked})` },
              { id: 'locked', label: `Chưa mở (${total - unlocked})` },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <Press
                key={tab.id}
                onPress={() => setFilter(tab.id)}
                pressScale={0.97}
                style={{
                  paddingHorizontal: s(10),
                  paddingVertical: s(4),
                  borderRadius: s(8),
                  backgroundColor: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                }}
              >
                <T size={10} weight={active ? 'semibold' : 'medium'} color={active ? '#ffffff' : 'rgba(255,255,255,0.45)'}>
                  {tab.label}
                </T>
              </Press>
            );
          })}
        </View>
      </View>

      {/* List */}
      <View style={{ gap: s(8) }}>
        {filtered.map((achievement) => (
          <AchievementRowItem key={achievement.apiName} achievement={achievement} />
        ))}
      </View>
    </View>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { s } = useUi();
  return (
    <View style={{ gap: s(8) }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={s(64)} radius={s(12)} tone={0.06} />
      ))}
    </View>
  );
}

// ============================================================================
// UNIFIED APPLE GAME DETAIL PANEL
// ============================================================================

export function GameDetailPanel({
  game,
  activeTab = 'info',
  onTabChange,
  achievementsData,
  achievementsLoading = false,
  achievementsError = null,
  onClose,
}: {
  game: PcGame;
  activeTab?: GameDetailTab;
  onTabChange?: (tab: GameDetailTab) => void;
  achievementsData?: AchievementResponse | null;
  achievementsLoading?: boolean;
  achievementsError?: string | null;
  onClose: () => void;
}) {
  const [currentTab, setCurrentTab] = useState<GameDetailTab>(activeTab);
  const effectiveTab = onTabChange ? activeTab : currentTab;

  const handleSelectTab = (tab: GameDetailTab) => {
    setCurrentTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const appId = useMemo(() => {
    return isSteamAppId(game.steamAppId) ? Number(game.steamAppId) : null;
  }, [game.steamAppId]);

  const tabs = useMemo(() => {
    const list: { id: GameDetailTab; label: string; icon: LucideIcon; badge?: string | number | null }[] = [
      { id: 'info', label: 'Thông tin', icon: Info },
    ];
    if (appId !== null) {
      list.push({ id: 'news', label: 'Cập nhật', icon: Newspaper });
      list.push({
        id: 'achievements',
        label: 'Thành tựu',
        icon: Trophy,
        badge: achievementsData?.supported ? `${achievementsData.unlocked || 0}/${achievementsData.total || 0}` : null,
      });
    }
    return list;
  }, [appId, achievementsData]);

  useGamepadTabs((direction) => {
    if (tabs.length <= 1) return false;
    const currentIndex = tabs.findIndex((t) => t.id === effectiveTab);
    if (currentIndex === -1) return false;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < tabs.length) {
      handleSelectTab(tabs[nextIndex].id);
      return true;
    }
    return false;
  }, tabs.length > 1);

  const subtitle = useMemo(() => {
    if (effectiveTab === 'info') return game.title;
    if (effectiveTab === 'news') return `Bản cập nhật & tin tức mới của ${game.title}`;
    if (effectiveTab === 'achievements') return `Thành tựu Steam của ${game.title}`;
    return game.title;
  }, [effectiveTab, game.title]);

  const titleText = useMemo(() => {
    if (effectiveTab === 'info') return 'Thông tin game';
    if (effectiveTab === 'news') return 'Cập nhật & bản sửa lỗi';
    if (effectiveTab === 'achievements') return 'Thành tựu Steam';
    return 'Chi tiết game';
  }, [effectiveTab]);

  return (
    <SidePanel
      title={titleText}
      subtitle={subtitle}
      width={560}
      onClose={onClose}
      headerExtension={
        tabs.length > 1 ? (
          <AppleTabBar tabs={tabs} activeTab={effectiveTab} onSelectTab={handleSelectTab} />
        ) : null
      }
    >
      <PanelTabContent key={effectiveTab}>
        {effectiveTab === 'info' && <GameInfoView game={game} />}
        {effectiveTab === 'news' && appId !== null && <GameNewsView appId={appId} />}
        {effectiveTab === 'achievements' && (
          <GameAchievementsView
            data={achievementsData || null}
            loading={achievementsLoading}
            error={achievementsError}
          />
        )}
      </PanelTabContent>
    </SidePanel>
  );
}

// ============================================================================
// CÁC COMPONENT ĐƠN LẺ ĐỂ DUY TRÌ TƯƠNG THÍCH NGƯỢC
// ============================================================================

export function GameInfoPanel({ game, onClose }: { game: PcGame; onClose: () => void }) {
  return <GameDetailPanel game={game} activeTab="info" onClose={onClose} />;
}

export function GameNewsPanel({
  appId,
  gameTitle,
  onClose,
}: {
  appId: number;
  gameTitle: string;
  onClose: () => void;
}) {
  const dummyGame: PcGame = {
    id: String(appId),
    title: gameTitle,
    source: 'Steam',
    steamAppId: String(appId),
    artworkUrl: '',
    heroUrl: '',
    sizeBytes: null,
    lastPlayed: null,
  };
  return <GameDetailPanel game={dummyGame} activeTab="news" onClose={onClose} />;
}

export function GameAchievementsPanel({
  gameTitle,
  data,
  loading,
  error,
  onClose,
}: {
  gameTitle: string;
  data: AchievementResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const dummyGame: PcGame = {
    id: 'achievements',
    title: gameTitle,
    source: 'Steam',
    steamAppId: data?.appId ? String(data.appId) : null,
    artworkUrl: '',
    heroUrl: '',
    sizeBytes: null,
    lastPlayed: null,
  };
  return (
    <GameDetailPanel
      game={dummyGame}
      activeTab="achievements"
      achievementsData={data}
      achievementsLoading={loading}
      achievementsError={error}
      onClose={onClose}
    />
  );
}
