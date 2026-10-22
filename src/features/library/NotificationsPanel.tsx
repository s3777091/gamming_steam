import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Megaphone,
  Download,
  Newspaper,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';

import { alpha, makeStyles, SurfaceSheen, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { PanelMessage, SidePanel, SteamLink } from '@/ui/SidePanel';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { DownloadNotificationCard, type DownloadItem } from './DownloadNotificationCard';
import { cleanSteamText, formatRelative, formatShortDate, formatStorePrice } from './format';
import type {
  AppNotification,
  GameDiscountNotification,
  GameUninstallNotification,
  GameUpdateNotification,
  SteamNewsItem,
  SteamStoreItem,
} from './types';

type NotificationTab = 'all' | 'downloads' | 'discounts' | 'updates';

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
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const meta = newsMeta([gameTitle, item.feedLabel, item.author, formatShortDate(item.publishedAt)]);

  return (
    <View>
      <Press
        onPress={onBack}
        style={{
          flexDirection: 'row',
          alignItems: 'center', overflow: 'visible',
          gap: s(6),
          paddingVertical: s(6), paddingHorizontal: s(10), marginLeft: -s(10), borderRadius: s(10),
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
          {cleanSteamText(item.title) || item.title}
        </T>
        {meta ? (
          <T size={10} color={colors.text4} style={{ marginTop: s(8) }}>
            {meta}
          </T>
        ) : null}
        <T size={11.5} color={colors.text3} leading={1.65} style={{ marginTop: s(16) }}>
          {cleanSteamText(item.summary) || 'Bài cập nhật này chưa có nội dung tóm tắt.'}
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
  onDismiss,
}: {
  item: GameDiscountNotification;
  onPress: () => void;
  onDismiss?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const originalPriceFormatted = item.originalPrice && item.currency
    ? formatStorePrice({ finalPrice: item.originalPrice, currency: item.currency })
    : null;
  const finalPriceFormatted = formatStorePrice({ finalPrice: item.finalPrice, currency: item.currency });

  return (
    <View style={[styles.card, styles.notifCard, { padding: s(6), paddingRight: s(10), borderRadius: s(16), gap: s(6) }]}>
      {/* Specular top rim */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(16), overflow: 'hidden' }]}><SurfaceSheen /></View>

      <Press
        onPress={onPress}
        pressScale={0.98}
        accessibilityLabel={`Xem game giảm giá ${item.gameTitle}`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(12), padding: s(6), borderRadius: s(12) }}
      >
        <View style={[styles.imageBox, { width: s(96), height: s(54), borderRadius: s(9) }]}>
          <Img source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <View style={[styles.discountTag, { top: s(4), left: s(4), borderRadius: s(5), paddingHorizontal: s(5), paddingVertical: s(1.5) }]}>
            <T size={8.5} weight="bold" color="#fff" tabular>
              -{item.discountPercent}%
            </T>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <View style={[styles.pillBadge, { borderRadius: s(5), paddingHorizontal: s(6), paddingVertical: s(1.5) }]}>
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

      {onDismiss ? (
        <Press
          onPress={onDismiss}
          sound="confirm"
          pressScale={0.92}
          accessibilityLabel={`Xóa thông báo ${item.gameTitle}`}
          style={[styles.dismissBtn, { width: s(28), height: s(28), borderRadius: s(14) }]}
        >
          <X size={s(13)} color={colors.text3} strokeWidth={2} />
        </Press>
      ) : null}
    </View>
  );
}

function UpdateNotificationCard({
  item,
  onPress,
  onDismiss,
}: {
  item: GameUpdateNotification;
  onPress: () => void;
  onDismiss?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const timeAgo = formatRelative(item.publishedAt);

  return (
    <View style={[styles.card, styles.notifCard, { padding: s(6), paddingRight: s(10), borderRadius: s(16), gap: s(6) }]}>
      {/* Specular top rim */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(16), overflow: 'hidden' }]}><SurfaceSheen /></View>

      <Press
        onPress={onPress}
        pressScale={0.98}
        accessibilityLabel={`Xem cập nhật ${item.gameTitle}: ${item.title}`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(12), padding: s(6), borderRadius: s(12) }}
      >
        <View style={[styles.imageBox, { width: s(96), height: s(54), borderRadius: s(9) }]}>
          <Img source={{ uri: item.gameImageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>

        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(6) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), flex: 1, minWidth: 0 }}>
              <View style={[styles.pillBadgeNews, { borderRadius: s(5), paddingHorizontal: s(6), paddingVertical: s(1.5) }]}>
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
            {cleanSteamText(item.title) || item.title}
          </T>

          {item.summary ? (
            <T size={10} color={colors.text3} numberOfLines={2} leading={1.35} style={{ marginTop: s(2) }}>
              {cleanSteamText(item.summary)}
            </T>
          ) : null}
        </View>

        <ChevronRight size={s(16)} color={colors.text4} strokeWidth={1.8} style={{ alignSelf: 'center' }} />
      </Press>

      {onDismiss ? (
        <Press
          onPress={onDismiss}
          sound="confirm"
          pressScale={0.92}
          accessibilityLabel={`Xóa thông báo ${item.title}`}
          style={[styles.dismissBtn, { width: s(28), height: s(28), borderRadius: s(14) }]}
        >
          <X size={s(13)} color={colors.text3} strokeWidth={2} />
        </Press>
      ) : null}
    </View>
  );
}

function UninstallNotificationCard({
  item,
  onPress,
  onDismiss,
}: {
  item: GameUninstallNotification;
  onPress?: () => void;
  onDismiss?: () => void;
}) {
  const { glass, colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const timeAgo = formatRelative(item.createdAt ? new Date(item.createdAt).toISOString() : null);

  return (
    <View style={[styles.card, styles.notifCard, { padding: s(6), paddingRight: s(10), borderRadius: s(16), gap: s(6) }]}>
      {/* Specular top rim */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(16), overflow: 'hidden' }]}><SurfaceSheen /></View>

      <Press
        onPress={onPress}
        pressScale={0.98}
        accessibilityLabel={`Xem trò chơi ${item.gameTitle}`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(12), padding: s(6), borderRadius: s(12) }}
      >
        <View style={[styles.imageBox, { width: s(96), height: s(54), borderRadius: s(9) }]}>
          {item.gameImageUrl ? (
            <Img source={{ uri: item.gameImageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: glass.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={s(20)} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(6) }}>
            <View style={[styles.pillBadgeUninstall, { borderRadius: s(5), paddingHorizontal: s(6), paddingVertical: s(1.5) }]}>
              <Trash2 size={s(9)} color="#f87171" strokeWidth={2} />
              <T size={8.5} weight="semibold" color="#f87171">
                ĐÃ GỠ CÀI ĐẶT
              </T>
            </View>
            {timeAgo ? (
              <T size={9} color={colors.text4} tabular>
                {timeAgo}
              </T>
            ) : null}
          </View>

          <T size={12} weight="semibold" color={colors.text} numberOfLines={1} style={{ marginTop: s(4) }}>
            {item.gameTitle}
          </T>

          <T size={10} color={colors.text3} numberOfLines={2} leading={1.35} style={{ marginTop: s(2) }}>
            {item.message || 'Đã gỡ khỏi máy tính. Trò chơi vẫn còn trong thư viện Steam.'}
          </T>
        </View>

        <ChevronRight size={s(16)} color={colors.text4} strokeWidth={1.8} style={{ alignSelf: 'center' }} />
      </Press>

      {onDismiss ? (
        <Press
          onPress={onDismiss}
          sound="confirm"
          pressScale={0.92}
          accessibilityLabel={`Xóa thông báo ${item.gameTitle}`}
          style={[styles.dismissBtn, { width: s(28), height: s(28), borderRadius: s(14) }]}
        >
          <X size={s(13)} color={colors.text3} strokeWidth={2} />
        </Press>
      ) : null}
    </View>
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
  downloads,
  canControlDownloads,
  loading,
  error,
  onOpenStoreGame,
  onSelectGame,
  onPauseDownload,
  onResumeDownload,
  onOpenDownloadPrompt,
  onClearAll,
  onClearNotification,
  onClose,
}: {
  notifications: AppNotification[];
  discounts: GameDiscountNotification[];
  updates: GameUpdateNotification[];
  downloads: DownloadItem[];
  canControlDownloads: boolean;
  loading: boolean;
  error: string | null;
  onOpenStoreGame: (item: SteamStoreItem) => void;
  onSelectGame?: (appId: number) => void;
  onPauseDownload: (appid: number) => void;
  onResumeDownload: (appid: number) => void;
  onOpenDownloadPrompt: (appid: number) => void;
  onClearAll?: (category?: 'all' | 'discounts' | 'updates') => void;
  onClearNotification?: (id: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  // Có lượt tải đang chạy thì mở thẳng tab Tải xuống: đó là lý do người dùng bấm vào chuông.
  const [activeTab, setActiveTab] = useState<NotificationTab>(() => (downloads.length ? 'downloads' : 'all'));
  const [selectedNews, setSelectedNews] = useState<GameUpdateNotification | null>(null);

  const tabs: { id: NotificationTab; label: string }[] = [
    { id: 'all', label: `Tất cả (${notifications.length + downloads.length})` },
    ...(downloads.length ? [{ id: 'downloads' as const, label: `Tải xuống (${downloads.length})` }] : []),
    { id: 'discounts', label: `Giảm giá (${discounts.length})` },
    { id: 'updates', label: `Cập nhật game (${updates.length})` },
  ];
  const tab = tabs.some((entry) => entry.id === activeTab) ? activeTab : 'all';

  const feedItems = tab === 'all' ? notifications : tab === 'discounts' ? discounts : tab === 'updates' ? updates : [];
  const downloadRows = tab === 'all' || tab === 'downloads' ? downloads : [];
  const nothing = !downloadRows.length && !feedItems.length;

  const hasClearable = tab === 'all'
    ? notifications.length > 0
    : tab === 'discounts'
    ? discounts.length > 0
    : tab === 'updates'
    ? updates.length > 0
    : false;

  const handleClear = () => {
    if (!onClearAll) return;
    if (tab === 'discounts') onClearAll('discounts');
    else if (tab === 'updates') onClearAll('updates');
    else onClearAll('all');
  };

  const clearHeaderAction = hasClearable && onClearAll ? (
    <Press
      onPress={handleClear}
      sound="confirm"
      pressScale={0.96}
      accessibilityLabel={
        tab === 'discounts'
          ? 'Xóa tất cả thông báo giảm giá'
          : tab === 'updates'
          ? 'Xóa tất cả thông báo cập nhật'
          : 'Xóa tất cả thông báo tin nhắn'
      }
      style={[
        styles.clearButton,
        {
          height: s(28),
          paddingHorizontal: s(10),
          borderRadius: s(14),
          gap: s(5),
        },
      ]}
    >
      <Trash2 size={s(12)} color="rgba(255,255,255,0.72)" strokeWidth={1.8} />
      <T size={10} weight="medium" color="rgba(255,255,255,0.85)">
        Xóa thông báo
      </T>
    </Press>
  ) : null;

  return (
    <SidePanel
      title="Thông báo"
      subtitle="Tải xuống, ưu đãi Steam & cập nhật game đã cài"
      width={540}
      action={clearHeaderAction}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) }}>
            <View style={{ flexDirection: 'row', gap: s(8), flexWrap: 'wrap', flex: 1 }}>
              {tabs.map((entry) => {
                const on = tab === entry.id;
                return (
                  <Press
                    key={entry.id}
                    onPress={() => setActiveTab(entry.id)}
                    style={[
                      styles.tabPill,
                      {
                        height: s(28),
                        paddingHorizontal: s(10),
                        borderRadius: s(14),
                        backgroundColor: on ? alpha(colors.accent, 0.18) : 'rgba(255,255,255,0.06)',
                        borderColor: on ? alpha(colors.accent, 0.35) : 'rgba(255,255,255,0.1)',
                      },
                    ]}
                  >
                    <T size={10} weight="semibold" color={on ? colors.white : colors.text3}>{entry.label}</T>
                  </Press>
                );
              })}
            </View>
          </View>

          <View style={{ gap: s(8) }}>
            {downloadRows.map((item) => (
              <DownloadNotificationCard
                key={item.download.appid}
                item={item}
                canControl={canControlDownloads}
                onPause={onPauseDownload}
                onResume={onResumeDownload}
                onOpenPrompt={onOpenDownloadPrompt}
              />
            ))}
            {feedItems.map((item) => {
              if (item.type === 'discount') {
                return (
                  <DiscountNotificationCard
                    key={item.id}
                    item={item}
                    onPress={() => { onClose(); onOpenStoreGame(item.storeItem); }}
                    onDismiss={onClearNotification ? () => onClearNotification(item.id) : undefined}
                  />
                );
              }
              if (item.type === 'uninstall') {
                return (
                  <UninstallNotificationCard
                    key={item.id}
                    item={item}
                    onPress={() => {
                      if (onSelectGame) {
                        onSelectGame(item.appId);
                        onClose();
                      }
                    }}
                    onDismiss={onClearNotification ? () => onClearNotification(item.id) : undefined}
                  />
                );
              }
              return (
                <UpdateNotificationCard
                  key={item.id}
                  item={item}
                  onPress={() => setSelectedNews(item)}
                  onDismiss={onClearNotification ? () => onClearNotification(item.id) : undefined}
                />
              );
            })}
          </View>

          {nothing ? (
            tab === 'downloads' ? (
              <PanelMessage icon={Download} message="Chưa có lượt tải nào." hint="Bấm Cài đặt ở một game chưa có trên máy tính để bắt đầu." />
            ) : loading ? (
              <ListSkeleton rows={4} />
            ) : error ? (
              <PanelMessage icon={Megaphone} message={error} hint="Kiểm tra kết nối tới máy tính và thử lại." />
            ) : (
              <PanelMessage
                icon={Megaphone}
                message="Không có thông báo nào trong mục này."
                hint={tab === 'discounts' ? 'Hiện không có trò chơi nào đang có khuyến mãi mới.' : 'Các trò chơi đã cài chưa có thông báo cập nhật mới.'}
              />
            )
          ) : null}
        </View>
      )}
    </SidePanel>
  );
}

const useStyles = makeStyles(({ colors, glass }) => ({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    backgroundColor: glass.surfaceUltraThin,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center', overflow: 'visible',
  },
  imageBox: {
    overflow: 'hidden',
    backgroundColor: glass.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
  },
  discountTag: {
    position: 'absolute',
    backgroundColor: colors.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.controlBorderActive,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center', overflow: 'visible',
    gap: 4,
    backgroundColor: alpha(colors.accent, 0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.accent, 0.3),
  },
  pillBadgeNews: {
    flexDirection: 'row',
    alignItems: 'center', overflow: 'visible',
    gap: 4,
    backgroundColor: glass.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.controlBorder,
  },
  pillBadgeUninstall: {
    flexDirection: 'row',
    alignItems: 'center', overflow: 'visible',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  tabPill: {
    alignItems: 'center', overflow: 'visible',
    justifyContent: 'center',
    borderWidth: 1,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center', overflow: 'visible',
    justifyContent: 'center',
    backgroundColor: glass.surface,
    borderWidth: 1,
    borderColor: glass.border,
  },
  dismissBtn: {
    alignItems: 'center', overflow: 'visible',
    justifyContent: 'center',
    backgroundColor: glass.surfaceThin,
    borderWidth: 1,
    borderColor: glass.border,
  },
}));
