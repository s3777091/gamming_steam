import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PC_ROUTES, pcFetchJson, pcPostJson } from '@/lib/pc-api';

import { isSteamAppId } from './format';
import type { AchievementResponse, GameResponse, PcGame, SteamProfile } from './types';
import { useCachedResource } from './useCachedResource';

const CACHE_KEY = 'jetsona:pc-games:v6';

export function fetchAchievements(appId: number, signal?: AbortSignal) {
  return pcFetchJson<AchievementResponse>(
    PC_ROUTES.gameAchievements(appId),
    'Không tải được achievement từ Steam.',
    undefined,
    signal,
  );
}

type Snapshot = { games: PcGame[]; steamProfile: SteamProfile | null };

/** Khôi phục thư viện lần trước để màn hình lên hình ngay, trước khi PC trả lời. */
async function readCachedLibrary(): Promise<Snapshot> {
  const empty: Snapshot = { games: [], steamProfile: null };
  try {
    const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null') as unknown;
    if (!cached || typeof cached !== 'object') return empty;
    const raw = (cached as { games?: unknown }).games;
    const games = (Array.isArray(raw) ? raw : []).filter((item): item is PcGame => (
      Boolean(item)
      && typeof item === 'object'
      && typeof (item as PcGame).id === 'string'
      && typeof (item as PcGame).title === 'string'
    ));
    const profile = (cached as { steamProfile?: unknown }).steamProfile;
    const steamProfile = profile && typeof profile === 'object' && typeof (profile as SteamProfile).personaName === 'string'
      ? profile as SteamProfile
      : null;
    return { games, steamProfile };
  } catch {
    return empty;
  }
}

export type LaunchResult = { sessionId: string | null; resumed: boolean };

/** Game cài sẵn (hoặc cài được) trên PC, cộng thao tác mở/cài và achievement của game đang chọn. */
export function usePcLibrary() {
  const [games, setGames] = useState<PcGame[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reachable, setReachable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryWarning, setLibraryWarning] = useState<string | null>(null);
  const [steamProfile, setSteamProfile] = useState<SteamProfile | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installOpenedId, setInstallOpenedId] = useState<string | null>(null);
  const achievementCache = useRef(new Map<number, AchievementResponse>());
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const loadGames = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(null);
    try {
      const data = await pcFetchJson<GameResponse>(
        PC_ROUTES.games,
        'Không đọc được thư viện trò chơi trên máy tính.',
        (body) => Array.isArray(body.games),
      );
      if (!mounted.current) return;
      const nextGames = data.games!;
      setGames(nextGames);
      setSteamProfile(data.steamProfile || null);
      setLibraryWarning(data.steamWarning || null);
      setSelectedId((current) => (
        current && nextGames.some((game) => game.id === current) ? current : nextGames[0]?.id ?? null
      ));
      setReachable(true);
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        games: nextGames,
        steamProfile: data.steamProfile || null,
      })).catch(() => {});
    } catch (loadError) {
      if (!mounted.current) return;
      setReachable(false);
      setError(loadError instanceof Error ? loadError.message : 'Không kết nối được máy tính.');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void readCachedLibrary().then((cached) => {
      if (!active) return;
      if (cached.games.length) {
        setGames((current) => (current.length ? current : cached.games));
        setSelectedId((current) => current ?? cached.games[0].id);
      }
      if (cached.steamProfile) setSteamProfile((current) => current ?? cached.steamProfile);
    });
    void loadGames();
    return () => { active = false; };
  }, [loadGames]);

  const selected = useMemo(
    () => games.find((game) => game.id === selectedId) ?? games[0] ?? null,
    [games, selectedId],
  );

  const achievements = useCachedResource(
    isSteamAppId(selected?.steamAppId) ? Number(selected.steamAppId) : null,
    achievementCache,
    fetchAchievements,
    'Không tải được achievement từ Steam.',
  );

  /**
   * Bắt đầu phiên chơi: PC bật booster NGAY, trả về `sessionId` để màn loading
   * theo dõi. Không chuyển màn ở đây — việc đó thuộc về nơi gọi.
   */
  const launchSelected = useCallback(async (): Promise<LaunchResult | null> => {
    if (!selected || launchingId) return null;
    setLaunchingId(selected.id);
    setError(null);
    try {
      const launched = await pcPostJson<{ ok?: boolean; sessionId?: unknown; resumed?: boolean }>(
        PC_ROUTES.gameLaunch,
        { id: selected.id },
        'Không mở được trò chơi.',
      );
      return {
        sessionId: typeof launched.sessionId === 'string' ? launched.sessionId : null,
        resumed: Boolean(launched.resumed),
      };
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : 'Không mở được trò chơi.');
      return null;
    } finally {
      if (mounted.current) setLaunchingId(null);
    }
  }, [launchingId, selected]);

  /** true khi PC đã nhận lệnh cài. */
  const installSelected = useCallback(async (): Promise<boolean> => {
    if (!selected || installingId) return false;
    setInstallingId(selected.id);
    setInstallOpenedId(null);
    setError(null);
    try {
      const result = await pcPostJson<{ ok?: boolean; error?: string; downloadAgent?: boolean }>(
        PC_ROUTES.gameInstall,
        { id: selected.id },
        'Không mở được trình cài đặt Steam.',
      );
      // Có agent tải game: tiến trình đi thẳng về qua DataChannel. Không có (PC cũ)
      // thì Steam mở hộp thoại trên máy tính như trước.
      if (mounted.current && !result.downloadAgent) setInstallOpenedId(selected.id);
      return true;
    } catch (installError) {
      if (mounted.current) setError(installError instanceof Error ? installError.message : 'Không mở được trình cài đặt Steam.');
      return false;
    } finally {
      if (mounted.current) setInstallingId(null);
    }
  }, [installingId, selected]);

  return {
    games,
    selected,
    selectGame: setSelectedId,
    loading,
    refreshing,
    reachable,
    error,
    libraryWarning,
    steamProfile,
    reload: loadGames,
    launchingId,
    installingId,
    installOpenedId,
    launchSelected,
    installSelected,
    achievements,
    achievementCache,
  };
}

export type PcLibrary = ReturnType<typeof usePcLibrary>;
