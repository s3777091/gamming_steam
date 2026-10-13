import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { isSteamAppId } from './format';
import type {
  AppNotification,
  GameDiscountNotification,
  GameUpdateNotification,
  NewsResponse,
  PcGame,
  StoreResponse,
} from './types';

const LAST_READ_KEY = 'jetsona:notifications:last_read:v1';
const MAX_GAMES_NEWS = 6;

export function useNotifications(games: PcGame[]) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadedOnce = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const lastReadStr = await AsyncStorage.getItem(LAST_READ_KEY).catch(() => null);
      const lastReadTime = lastReadStr ? Number(lastReadStr) : 0;

      // 1. Tải danh sách giảm giá Steam Store
      let storeData: StoreResponse | null = null;
      try {
        storeData = await pcFetchJson<StoreResponse>(
          PC_ROUTES.store,
          'Không tải được ưu đãi Steam.',
          (body) => Boolean(body.featured || body.specials),
        );
      } catch {
        // Nếu không tải được store (offline), bỏ qua
      }

      const discounts: GameDiscountNotification[] = [];
      const seenAppIds = new Set<number>();

      if (storeData?.featured?.discounted && storeData.featured.discountPercent > 0) {
        const item = storeData.featured;
        seenAppIds.add(item.appId);
        discounts.push({
          id: `discount-${item.appId}`,
          type: 'discount',
          appId: item.appId,
          gameTitle: item.name,
          discountPercent: item.discountPercent,
          originalPrice: item.originalPrice,
          finalPrice: item.finalPrice,
          currency: item.currency,
          imageUrl: item.headerImage || item.largeImage || item.smallImage,
          storeItem: item,
        });
      }

      if (storeData?.specials) {
        for (const item of storeData.specials) {
          if (seenAppIds.has(item.appId)) continue;
          seenAppIds.add(item.appId);
          discounts.push({
            id: `discount-${item.appId}`,
            type: 'discount',
            appId: item.appId,
            gameTitle: item.name,
            discountPercent: item.discountPercent,
            originalPrice: item.originalPrice,
            finalPrice: item.finalPrice,
            currency: item.currency,
            imageUrl: item.headerImage || item.largeImage || item.smallImage,
            storeItem: item,
          });
        }
      }

      // 2. Tải bản tin cập nhật của các game đã cài đặt
      const installedGames = games
        .filter((g) => g.installed !== false && isSteamAppId(g.steamAppId))
        .slice(0, MAX_GAMES_NEWS);

      const newsPromises = installedGames.map(async (game) => {
        const appId = Number(game.steamAppId);
        try {
          const res = await pcFetchJson<NewsResponse>(
            PC_ROUTES.gameNews(appId),
            'Không tải được tin tức.',
            (body) => Array.isArray(body.items),
          );
          return { game, items: res.items || [] };
        } catch {
          return { game, items: [] };
        }
      });

      const newsResults = await Promise.allSettled(newsPromises);
      const updates: GameUpdateNotification[] = [];

      for (const res of newsResults) {
        if (res.status !== 'fulfilled') continue;
        const { game, items } = res.value;
        const appId = Number(game.steamAppId);

        // Lấy tối đa 2 tin mới nhất cho mỗi game
        for (const item of items.slice(0, 2)) {
          updates.push({
            id: `news-${item.id}`,
            type: 'update',
            appId,
            gameTitle: game.title,
            gameImageUrl: game.artworkUrl || game.heroUrl,
            title: item.title,
            summary: item.summary,
            feedLabel: item.feedLabel,
            author: item.author,
            url: item.url,
            publishedAt: item.publishedAt,
            rawNews: item,
          });
        }
      }

      // Sắp xếp cập nhật theo ngày mới nhất
      updates.sort((a, b) => {
        const tA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const tB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return tB - tA;
      });

      // Hợp nhất: đan xen hoặc gom nhóm (giảm giá nổi bật trước, sau đó là cập nhật)
      const all: AppNotification[] = [...discounts, ...updates];

      if (!mounted.current) return;
      setNotifications(all);

      // Tính số lượng chưa đọc:
      if (lastReadTime === 0) {
        // Lần đầu mở app: báo số lượng các thông báo có sẵn (tối đa 5 để không bị ngợp)
        setUnreadCount(Math.min(all.length, 5));
      } else {
        // Đã từng đọc: đếm số tin mới hơn thời điểm đọc lần trước
        const newItems = all.filter((item) => {
          if (item.type === 'update' && item.publishedAt) {
            return Date.parse(item.publishedAt) > lastReadTime;
          }
          // Giảm giá coi là mới nếu chưa đọc trong vòng 24h
          return Date.now() - lastReadTime > 24 * 3600 * 1000;
        });
        setUnreadCount(newItems.length);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Không tải được thông báo.');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [games]);

  useEffect(() => {
    // Chỉ tự động tải lần đầu hoặc khi danh sách game thay đổi
    if (games.length > 0 && !loadedOnce.current) {
      loadedOnce.current = true;
      void loadNotifications();
    }
  }, [games, loadNotifications]);

  const markAllAsRead = useCallback(async () => {
    setUnreadCount(0);
    await AsyncStorage.setItem(LAST_READ_KEY, String(Date.now())).catch(() => {});
  }, []);

  const discounts = notifications.filter((n): n is GameDiscountNotification => n.type === 'discount');
  const updates = notifications.filter((n): n is GameUpdateNotification => n.type === 'update');

  return {
    notifications,
    discounts,
    updates,
    unreadCount,
    loading,
    error,
    reload: loadNotifications,
    markAllAsRead,
  };
}
