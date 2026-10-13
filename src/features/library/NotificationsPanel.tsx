import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Megaphone,
  Newspaper,
  Tag,
} from 'lucide-react-native';

import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { PanelMessage, SidePanel, SteamLink } from '@/ui/SidePanel';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { formatRelative, formatShortDate, formatStorePrice } from './format';
import type {
  AppNotification,
  GameDiscountNotification,
  GameUpdateNotification,
  SteamNewsItem,
  SteamStoreItem,
} from './types';

type NotificationTab = 'all' | 'discounts' | 'updates';

function newsMeta(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join('  /  ');
}

function ArticleDetailView({
  gameTitle,
  item,
  onBack,
}: {
  gameTitle: string;
  item: SteamNewsItem;
  onBack: () => void;
}) {
  const { s } = useUi();
  const meta = newsMeta([gameTitle, item.feedLabel, item.author, formatShortDate(item.publishedAt)]);

  return (
    <View>
      <Press
        onPress={onBack}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
          paddingVertical: s(6),
          alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={s(14)} color={colors.text3} strokeWidth={1.8} />
        <T size={11} color={colors.text3}>
          Tất cả thông báo
        </T>
      </Press>
      <View style={[styles.card, { marginTop: s(10), padding: s(16), borderRadius: s(16) }]}>
        <T size={16} weight="semibold" leading={1.3} tracking={-0.02}>
          {item.title}
        </T>
        {meta ? (
          <T size={10} color={colors.text4} style={{ marginTop: s(8) }}>
            {meta}
          </T>
        ) : null}
        <T size={11.5} color={colors.text3} leading={1.65} style={{ marginTop: s(16) }}>
          {item.summary || 'Bài cập nhật này chưa có nội dung tóm tắt.'}
        </T>
        {item.url ? (
          <SteamLink href={item.url} style={{ marginTop: s(16) }}>
            Mở bài viết trên Steam
          </SteamLink>
        ) : null}
      </View>
    </View>
  );
}

function DiscountNotificationCard({
  item,
  onPress,
}: {
  item: GameDiscountNotification;
  onPress: () => void;
}) {
  const { s } = useUi();
  const originalPriceFormatted = item.originalPrice && item.currency
    ? formatStorePrice({ finalPrice: item.originalPrice, currency: item.currency })
    : null;
  const finalPriceFormatted = formatStorePrice({ finalPrice: item.finalPrice, currency: item.currency });

  return (
    <Press
      onPress={onPress}
      pressScale={0.98}
      accessibilityLabel={`Xem game giảm giá ${item.gameTitle}`}
      style={[styles.card, styles.notifCard, { padding: s(12), borderRadius: s(14), gap: s(12) }]}
    >
      <View style={[styles.imageBox, { width: s(96), height: s(54), borderRadius: s(8) }]}>
        <Img source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        <View style={[styles.discountTag, { top: s(4), left: s(4), borderRadius: s(4), paddingHorizontal: s(4), paddingVertical: s(1.5) }]}>
          <T size={8.5} weight="bold" color="#fff" tabular>
            -{item.discountPercent}%
          </T>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <View style={[styles.pillBadge, { borderRadius: s(4), paddingHorizontal: s(5), paddingVertical: s(1.5) }]}>
            <Tag size={s(9)} color={colors.accent} strokeWidth={2} />
            <T size={8.5} weight="semibold" color={colors.accent}>
              GIẢM GIÁ STEAM
            </T>
          </View>
        </View>

        <T size={12} weight="semibold" color={colors.text} numberOfLines={1} style={{ marginTop: s(4) }}>
          {item.gameTitle}
        </T>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: s(3) }}>
          {originalPriceFormatted && originalPriceFormatted !== finalPriceFormatted ? (
            <T size={9.5} color={colors.text4} style={{ textDecorationLine: 'line-through' }}>
              {originalPriceFormatted}
            </T>
          ) : null}
          <T size={10.5} weight="semibold" color={colors.accent} tabular>
            {finalPriceFormatted}
          </T>
        </View>
      </View>

      <ChevronRight size={s(16)} color={colors.text4} strokeWidth={1.8} style={{ alignSelf: 'center' }} />
    </Press>
  );
}

function UpdateNotificationCard({
  item,
  onPress,
}: {
  item: GameUpdateNotification;
  onPress: () => void;
}) {
  const { s } = useUi();
  const timeAgo = formatRelative(item.publishedAt);

  return (
    <Press
      onPress={onPress}
      pressScale={0.98}
      accessibilityLabel={`Xem cập nhật ${item.gameTitle}: ${item.title}`}
      style={[styles.card, styles.notifCard, { padding: s(12), borderRadius: s(14), gap: s(12) }]}
    >
      <View style={[styles.imageBox, { width: s(96), height: s(54), borderRadius: s(8) }]}>
        <Img source={{ uri: item.gameImageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(6) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), flex: 1, minWidth: 0 }}>
            <View style={[styles.pillBadgeNews, { borderRadius: s(4), paddingHorizontal: s(5), paddingVertical: s(1.5) }]}>
              <Newspaper size={s(9)} color="#8dc0ff" strokeWidth={2} />
              <T size={8.5} weight="semibold" color="#8dc0ff" numberOfLines={1}>
                {item.feedLabel || 'BẢN CẬP NHẬT'}
              </T>
            </View>
            <T size={9.5} color={colors.text3} numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.gameTitle}
            </T>
          </View>
          {timeAgo ? (
            <T size={9} color={colors.text4} tabular>
              {timeAgo}
            </T>
          ) : null}
        </View>

        <T size={11.5} weight="semibold" color={colors.text} numberOfLines={1} style={{ marginTop: s(4) }}>
          {item.title}
        </T>

        {item.summary ? (
          <T size={10} color={colors.text3} numberOfLines={2} leading={1.35} style={{ marginTop: s(2) }}>
            {item.summary}
          </T>
        ) : null}
      </View>

      <ChevronRight size={s(16)} color={colors.text4} strokeWidth={1.8} style={{ alignSelf: 'center' }} />
    </Press>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { s } = useUi();
  return (
    <View style={{ gap: s(8) }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={s(74)} radius={s(14)} tone={0.06} />
      ))}
    </View>
  );
}

export function NotificationsPanel({
  notifications,
  discounts,
  updates,
  loading,
  error,
  onOpenStoreGame,
  onClose,
}: {
  notifications: AppNotification[];
  discounts: GameDiscountNotification[];
  updates: GameUpdateNotification[];
  loading: boolean;
  error: string | null;
  onOpenStoreGame: (item: SteamStoreItem) => void;
  onClose: () => void;
}) {
  const { s } = useUi();
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [selectedNews, setSelectedNews] = useState<GameUpdateNotification | null>(null);

  const displayedItems = activeTab === 'all'
    ? notifications
    : activeTab === 'discounts'
      ? discounts
      : updates;

  return (
    <SidePanel
      title="Thông báo"
      subtitle="Ưu đãi Steam & Cập nhật game đã cài"
      width={540}
      onClose={onClose}
    >
      {selectedNews ? (
        <ArticleDetailView
          gameTitle={selectedNews.gameTitle}
          item={selectedNews.rawNews}
          onBack={() => setSelectedNews(null)}
        />
      ) : (
        <View style={{ gap: s(12) }}>
          {/* Thanh chuyển tab phân loại */}
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <Press
              onPress={() => setActiveTab('all')}
              style={[
                styles.tabPill,
                {
                  height: s(28),
                  paddingHorizontal: s(10),
                  borderRadius: s(14),
                  backgroundColor: activeTab === 'all' ? 'rgba(102,168,255,0.18)' : 'rgba(255,255,255,0.06)',
                  borderColor: activeTab === 'all' ? 'rgba(102,168,255,0.35)' : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <T size={10} weight="semibold" color={activeTab === 'all' ? colors.white : colors.text3}>
                Tất cả ({notifications.length})
              </T>
            </Press>

            <Press
              onPress={() => setActiveTab('discounts')}
              style={[
                styles.tabPill,
                {
                  height: s(28),
                  paddingHorizontal: s(10),
                  borderRadius: s(14),
                  backgroundColor: activeTab === 'discounts' ? 'rgba(102,168,255,0.18)' : 'rgba(255,255,255,0.06)',
                  borderColor: activeTab === 'discounts' ? 'rgba(102,168,255,0.35)' : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <T size={10} weight="semibold" color={activeTab === 'discounts' ? colors.white : colors.text3}>
                Giảm giá ({discounts.length})
              </T>
            </Press>

            <Press
              onPress={() => setActiveTab('updates')}
              style={[
                styles.tabPill,
                {
                  height: s(28),
                  paddingHorizontal: s(10),
                  borderRadius: s(14),
                  backgroundColor: activeTab === 'updates' ? 'rgba(102,168,255,0.18)' : 'rgba(255,255,255,0.06)',
                  borderColor: activeTab === 'updates' ? 'rgba(102,168,255,0.35)' : 'rgba(255,255,255,0.1)',
                },
              ]}
            >
              <T size={10} weight="semibold" color={activeTab === 'updates' ? colors.white : colors.text3}>
                Cập nhật game ({updates.length})
              </T>
            </Press>
          </View>

          {/* Danh sách thông báo */}
          {loading && !notifications.length ? (
            <ListSkeleton rows={4} />
          ) : error && !notifications.length ? (
            <PanelMessage icon={Megaphone} message={error} hint="Kiểm tra kết nối tới máy tính và thử lại." />
          ) : displayedItems.length === 0 ? (
            <PanelMessage
              icon={Megaphone}
              message="Không có thông báo nào trong mục này."
              hint={activeTab === 'discounts' ? 'Hiện không có trò chơi nào đang có khuyến mãi mới.' : 'Các trò chơi đã cài chưa có thông báo cập nhật mới.'}
            />
          ) : (
            <View style={{ gap: s(8) }}>
              {displayedItems.map((item) => {
                if (item.type === 'discount') {
                  return (
                    <DiscountNotificationCard
                      key={item.id}
                      item={item}
                      onPress={() => onOpenStoreGame(item.storeItem)}
                    />
                  );
                }
                return (
                  <UpdateNotificationCard
                    key={item.id}
                    item={item}
                    onPress={() => setSelectedNews(item)}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}
    </SidePanel>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageBox: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  discountTag: {
    position: 'absolute',
    backgroundColor: colors.primary,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(102,168,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102,168,255,0.25)',
  },
  pillBadgeNews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tabPill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
