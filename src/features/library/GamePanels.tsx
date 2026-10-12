// Ba ngăn kéo của menu (…) cạnh nút Play: Thông tin game, Cập nhật & bản sửa
// lỗi, Thành tựu. Nội dung và chữ giữ nguyên bản web (game-library/Game*Panel).

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft, ChevronRight, LockKeyhole, Newspaper, Trophy } from 'lucide-react-native';

import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { PanelMessage, SidePanel, SteamLink } from '@/ui/SidePanel';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { formatShortDate, formatSize } from './format';
import type { AchievementResponse, NewsResponse, PcGame, SteamAchievement, SteamNewsItem } from './types';
import { useCachedResource } from './useCachedResource';

// ---------------------------------------------------------------- thông tin

function gameDetails(game: PcGame) {
  return [
    { label: 'Nhà phát triển', value: game.developer },
    { label: 'Nhà phát hành', value: game.publisher },
    { label: 'Thể loại', value: game.genres?.join(', ') || null },
    { label: 'Phát hành', value: game.releaseDate },
    { label: 'Dung lượng', value: formatSize(game.sizeBytes) },
    { label: 'Trạng thái', value: game.installed !== false ? 'Đã cài trên máy tính' : 'Chưa cài' },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
}

export function GameInfoPanel({ game, onClose }: { game: PcGame; onClose: () => void }) {
  const { s } = useUi();
  const details = gameDetails(game);
  return (
    <SidePanel title="Thông tin game" subtitle={game.title} onClose={onClose}>
      {details.length > 0 && (
        <View style={[styles.card, { padding: s(14), gap: s(10), borderRadius: s(16) }]}>
          {details.map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', gap: s(20) }}>
              <T size={11} color={colors.text4} style={{ width: s(96) }}>{item.label}</T>
              <T size={11} weight="medium" color={colors.text} style={{ flex: 1 }}>{item.value}</T>
            </View>
          ))}
        </View>
      )}
      {game.description ? (
        <T size={11.5} color={colors.text3} leading={1.65} style={{ marginTop: s(16) }}>{game.description}</T>
      ) : null}
      {game.storeUrl ? <SteamLink href={game.storeUrl} style={{ marginTop: s(16) }}>Xem trên Steam</SteamLink> : null}
    </SidePanel>
  );
}

// ---------------------------------------------------------------- thành tựu

function AchievementRow({ achievement }: { achievement: SteamAchievement }) {
  const { s } = useUi();
  const unlockedAt = formatShortDate(achievement.unlockTime);
  return (
    <View
      style={[
        styles.row,
        {
          padding: s(10), gap: s(12), borderRadius: s(12),
          backgroundColor: achievement.unlocked ? 'rgba(102,168,255,0.09)' : 'rgba(255,255,255,0.035)',
          borderColor: achievement.unlocked ? 'rgba(102,168,255,0.26)' : 'rgba(255,255,255,0.08)',
        },
      ]}
    >
      <View style={[styles.achievementIcon, { width: s(44), height: s(44), borderRadius: s(8) }]}>
        {achievement.iconUrl ? (
          <Img
            source={{ uri: achievement.iconUrl }}
            style={{ width: '100%', height: '100%', opacity: achievement.unlocked ? 1 : 0.55 }}
            contentFit="cover"
          />
        ) : achievement.unlocked ? (
          <Trophy size={s(20)} color="#8dc0ff" />
        ) : (
          <LockKeyhole size={s(16)} color={colors.text4} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: s(12) }}>
          <T size={12} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{achievement.name}</T>
          {unlockedAt ? <T size={9.5} color={colors.text4}>{unlockedAt}</T> : null}
        </View>
        <T size={10.5} color="rgba(255,255,255,0.46)" leading={1.35} numberOfLines={2} style={{ marginTop: s(2) }}>
          {achievement.description || (achievement.hidden ? 'Achievement ẩn' : 'Chưa có mô tả')}
        </T>
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

export function GameAchievementsPanel({ gameTitle, data, loading, error, onClose }: {
  gameTitle: string;
  data: AchievementResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const { s } = useUi();
  return (
    <SidePanel
      title={`Thành tựu của ${gameTitle}`}
      subtitle={data?.supported ? `Đã mở ${data.unlocked || 0} trong ${data.total || 0}` : 'Dữ liệu chính thức từ Steam'}
      onClose={onClose}
    >
      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <PanelMessage icon={LockKeyhole} message={error} hint="Trong Steam, đặt Game details thành Public rồi thử lại." />
      ) : data && !data.supported ? (
        <PanelMessage icon={Trophy} message="Trò chơi này không có Steam achievement." />
      ) : (
        <View style={{ gap: s(8) }}>
          {(data?.achievements || []).map((achievement) => (
            <AchievementRow key={achievement.apiName} achievement={achievement} />
          ))}
        </View>
      )}
    </SidePanel>
  );
}

// ---------------------------------------------------------------- cập nhật

// Giữ suốt vòng đời app để mở lại panel là có ngay.
const newsCache = { current: new Map<number, NewsResponse>() };

function fetchNews(appId: number, signal: AbortSignal) {
  return pcFetchJson<NewsResponse>(
    PC_ROUTES.gameNews(appId),
    'Không tải được thông tin cập nhật từ Steam.',
    (body) => Array.isArray(body.items),
    signal,
  );
}

function newsMeta(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join('  /  ');
}

function NewsArticle({ item, onBack }: { item: SteamNewsItem; onBack: () => void }) {
  const { s } = useUi();
  const meta = newsMeta([item.feedLabel, item.author, formatShortDate(item.publishedAt)]);
  return (
    <View>
      <Press onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(6), alignSelf: 'flex-start' }}>
        <ArrowLeft size={s(14)} color={colors.text3} strokeWidth={1.8} />
        <T size={11} color={colors.text3}>Tất cả cập nhật</T>
      </Press>
      <View style={[styles.card, { marginTop: s(10), padding: s(16), borderRadius: s(16) }]}>
        <T size={16} weight="semibold" leading={1.3} tracking={-0.02}>{item.title}</T>
        {meta ? <T size={10} color={colors.text4} style={{ marginTop: s(8) }}>{meta}</T> : null}
        <T size={11.5} color={colors.text3} leading={1.65} style={{ marginTop: s(16) }}>
          {item.summary || 'Bài cập nhật này chưa có nội dung tóm tắt.'}
        </T>
        {item.url ? <SteamLink href={item.url} style={{ marginTop: s(16) }}>Mở bài viết trên Steam</SteamLink> : null}
      </View>
    </View>
  );
}

function NewsListItem({ item, onOpen }: { item: SteamNewsItem; onOpen: () => void }) {
  const { s } = useUi();
  const meta = newsMeta([item.feedLabel, formatShortDate(item.publishedAt)]);
  return (
    <Press onPress={onOpen} pressScale={0.99} style={[styles.card, { padding: s(12), borderRadius: s(12) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s(12) }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={12} weight="semibold" leading={1.35} numberOfLines={2}>{item.title}</T>
          {meta ? <T size={10} color={colors.text4} style={{ marginTop: s(4) }}>{meta}</T> : null}
        </View>
        <ChevronRight size={s(16)} color={colors.text4} strokeWidth={1.8} />
      </View>
      {item.summary ? (
        <T size={10.5} color="rgba(255,255,255,0.48)" leading={1.45} numberOfLines={3} style={{ marginTop: s(8) }}>{item.summary}</T>
      ) : null}
    </Press>
  );
}

export function GameNewsPanel({ appId, gameTitle, onClose }: { appId: number; gameTitle: string; onClose: () => void }) {
  const { s } = useUi();
  const news = useCachedResource(appId, newsCache, fetchNews, 'Không tải được thông tin cập nhật từ Steam.');
  const [openItem, setOpenItem] = useState<SteamNewsItem | null>(null);
  const items = news.data?.items || [];
  return (
    <SidePanel
      title={`Cập nhật của ${gameTitle}`}
      subtitle="Tin cập nhật và bản sửa lỗi mới nhất từ Steam"
      width={540}
      onClose={onClose}
    >
      {news.loading ? (
        <ListSkeleton />
      ) : news.error ? (
        <PanelMessage icon={Newspaper} message={news.error} />
      ) : openItem ? (
        <NewsArticle item={openItem} onBack={() => setOpenItem(null)} />
      ) : items.length === 0 ? (
        <PanelMessage icon={Newspaper} message="Steam chưa đăng thông tin cập nhật cho game này." />
      ) : (
        <View style={{ gap: s(8) }}>
          {items.map((item) => <NewsListItem key={item.id} item={item} onOpen={() => setOpenItem(item)} />)}
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
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  achievementIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
