import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { isSteamAppId } from './format';
import type {
  AppNotification,
  GameDiscountNotification,
  GameUninstallNotification,
  GameUpdateNotification,
  NewsResponse,
  PcGame,
  StoreResponse,
} from './types';

const LAST_READ_KEY = 'jetsona:notifications:last_read:v1';
const CLEARED_KEY = 'jetsona:notifications:cleared_v1';
const LOCAL_NOTIFICATIONS_KEY = 'jetsona:notifications:local_v1';
const MAX_GAMES_NEWS = 6;

type ClearedState = {
  ids?: string[];
  clearedAt?: number;
};

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
      const [lastReadStr, clearedRaw, localRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_READ_KEY).catch(() => null),
        AsyncStorage.getItem(CLEARED_KEY).catch(() => null),
        AsyncStorage.getItem(LOCAL_NOTIFICATIONS_KEY).catch(() => null),
      ]);
      const lastReadTime = lastReadStr ? Number(lastReadStr) : 0;

      let clearedState: ClearedState = { ids: [] };
      if (clearedRaw) {
        try {
          clearedState = JSON.parse(clearedRaw);
        } catch {}
      }
      const clearedIds = new Set(clearedState.ids || []);
      const clearedAt = clearedState.clearedAt || 0;

      let localNotifs: GameUninstallNotification[] = [];
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            localNotifs = parsed.filter(
              (item): item is GameUninstallNotification =>
                Boolean(item?.id && item.type === 'uninstall' && !clearedIds.has(item.id))
            );
          }
        } catch {}
      }

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
        const notifId = `discount-${item.appId}`;
        if (!clearedIds.has(notifId)) {
          seenAppIds.add(item.appId);
          discounts.push({
            id: notifId,
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

      if (storeData?.specials) {
        for (const item of storeData.specials) {
          if (seenAppIds.has(item.appId)) continue;
          const notifId = `discount-${item.appId}`;
          if (clearedIds.has(notifId)) continue;
          seenAppIds.add(item.appId);
          discounts.push({
            id: notifId,
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
          const notifId = `news-${item.id}`;
          const itemTime = item.publishedAt ? Date.parse(item.publishedAt) : 0;
          if (clearedIds.has(notifId)) continue;
          if (clearedAt > 0 && itemTime <= clearedAt) continue;

          updates.push({
            id: notifId,
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

      // Hợp nhất: thông báo gỡ cài đặt mới nhất trước, sau đó là giảm giá và cập nhật
      const all: AppNotification[] = [...localNotifs, ...discounts, ...updates];

      if (!mounted.current) return;
      setNotifications(all);

      // Tính số lượng chưa đọc:
      if (lastReadTime === 0) {
        setUnreadCount(all.length);
      } else {
        // Đã từng đọc: đếm số tin mới hơn thời điểm đọc lần trước
        const newItems = all.filter((item) => {
          if (item.type === 'uninstall') {
            return item.createdAt > lastReadTime;
          }
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

  const addUninstallNotification = useCallback(async ({
    appId,
    gameTitle,
    gameImageUrl,
    message,
  }: {
    appId: number;
    gameTitle: string;
    gameImageUrl?: string | null;
    message?: string | null;
  }) => {
    const notif: GameUninstallNotification = {
      id: `uninstall-${appId}-${Date.now()}`,
      type: 'uninstall',
      appId,
      gameTitle,
      gameImageUrl: gameImageUrl || null,
      message: message || 'Đã gỡ khỏi máy tính. Trò chơi vẫn còn trong thư viện Steam.',
      createdAt: Date.now(),
    };

    setNotifications((prev) => [notif, ...prev.filter((item) => item.id !== notif.id)]);
    setUnreadCount((prev) => prev + 1);

    try {
      const localRaw = await AsyncStorage.getItem(LOCAL_NOTIFICATIONS_KEY).catch(() => null);
      let localList: GameUninstallNotification[] = [];
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) localList = parsed;
        } catch {}
      }
      localList = [notif, ...localList.filter((item) => item.appId !== appId)];
      await AsyncStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(localList));
    } catch {}
  }, []);

  const markAllAsRead = useCallback(async () => {
    setUnreadCount(0);
    await AsyncStorage.setItem(LAST_READ_KEY, String(Date.now())).catch(() => {});
  }, []);

  const clearNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      const [clearedRaw, localRaw] = await Promise.all([
        AsyncStorage.getItem(CLEARED_KEY).catch(() => null),
        AsyncStorage.getItem(LOCAL_NOTIFICATIONS_KEY).catch(() => null),
      ]);
      const state: ClearedState = clearedRaw ? JSON.parse(clearedRaw) : { ids: [] };
      const set = new Set(state.ids || []);
      set.add(id);
      state.ids = Array.from(set);
      await AsyncStorage.setItem(CLEARED_KEY, JSON.stringify(state));

      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            const nextLocal = parsed.filter((item) => item.id !== id);
            await AsyncStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(nextLocal));
          }
        } catch {}
      }
    } catch {}
  }, []);

  const clearAll = useCallback(async (category: 'all' | 'discounts' | 'updates' = 'all') => {
    const now = Date.now();
    let removedIds: string[] = [];
    setNotifications((prev) => {
      const keep = prev.filter((n) => {
        if (category === 'all') return false;
        if (category === 'discounts' && n.type === 'discount') return false;
        if (category === 'updates' && n.type === 'update') return false;
        return true;
      });
      removedIds = prev.filter((n) => !keep.includes(n)).map((n) => n.id);
      return keep;
    });

    if (category === 'all') {
      setUnreadCount(0);
      void AsyncStorage.removeItem(LOCAL_NOTIFICATIONS_KEY).catch(() => {});
    } else {
      setUnreadCount((prev) => Math.max(0, prev - removedIds.length));
    }

    try {
      const raw = await AsyncStorage.getItem(CLEARED_KEY).catch(() => null);
      const state: ClearedState = raw ? JSON.parse(raw) : { ids: [] };
      state.ids = Array.from(new Set([...(state.ids || []), ...removedIds]));
      if (category === 'all' || category === 'updates') {
        state.clearedAt = Math.max(state.clearedAt || 0, now);
      }
      await AsyncStorage.setItem(CLEARED_KEY, JSON.stringify(state));
    } catch {}
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
    clearNotification,
    clearAll,
    addUninstallNotification,
  };
}
