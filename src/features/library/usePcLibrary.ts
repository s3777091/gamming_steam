import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PC_ROUTES, pcFetchJson, pcPostJson } from '@/lib/pc-api';
import { TimedCache } from '@/lib/timed-cache';

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
/** `error` null khi bỏ qua vì đang có lượt cài khác. */
export type InstallResult = { ok: boolean; error: string | null };
export type UninstallResult = { ok: boolean; error: string | null };

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
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [installOpenedId, setInstallOpenedId] = useState<string | null>(null);
  const [achievementsCache] = useState(() => new TimedCache<number, AchievementResponse>(64, 60_000));
  const achievementCache = useRef(achievementsCache);
  const mounted = useRef(true);

  const inflight = useRef<{ promise: Promise<void>; controller: AbortController } | null>(null);
  const snapshotSignature = useRef<string | null>(null);
  const receivedNetworkSnapshot = useRef(false);
  const reloadQueued = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inflight.current?.controller.abort();
      inflight.current = null;
      reloadQueued.current = false;
    };
  }, []);

  const loadGames = useCallback(async function loadGames(manual = false): Promise<void> {
    if (!mounted.current) return;
    if (manual) setRefreshing(true);
    if (inflight.current) {
      // A completed install may invalidate a request that started before it.
      // Coalesce repeated refreshes, then fetch one fresh snapshot afterward.
      if (manual) reloadQueued.current = true;
      return inflight.current.promise;
    }
    const controller = new AbortController();
    const promise = (async () => {
      setError(null);
      try {
        const data = await pcFetchJson<GameResponse>(
          PC_ROUTES.games,
          'Không đọc được thư viện trò chơi trên máy tính.',
          (body) => Array.isArray(body.games),
          controller.signal,
        );
        if (!mounted.current || controller.signal.aborted) return;
        const nextGames = data.games!;
        receivedNetworkSnapshot.current = true;
        const signature = JSON.stringify({ games: nextGames, steamProfile: data.steamProfile || null });
        if (signature !== snapshotSignature.current) {
          snapshotSignature.current = signature;
          setGames(nextGames);
          setSteamProfile(data.steamProfile || null);
          void AsyncStorage.setItem(CACHE_KEY, signature).catch(() => {});
        }
        setLibraryWarning(data.steamWarning || null);
        setSelectedId((current) => (
          current && nextGames.some((game) => game.id === current) ? current : nextGames[0]?.id ?? null
        ));
        setReachable(true);
      } catch (loadError) {
        if (!mounted.current || controller.signal.aborted) return;
        setReachable(false);
        setError(loadError instanceof Error ? loadError.message : 'Không kết nối được máy tính.');
      } finally {
        if (inflight.current?.controller === controller) inflight.current = null;
        if (mounted.current && !controller.signal.aborted) {
          setLoading(false);
          if (reloadQueued.current) {
            reloadQueued.current = false;
            await loadGames(true);
          } else {
            setRefreshing(false);
          }
        }
      }
    })();
    inflight.current = { promise, controller };
    return promise;
  }, []);

  useEffect(() => {
    let active = true;
    void readCachedLibrary().then((cached) => {
      if (!active) return;
      if (!receivedNetworkSnapshot.current) {
        snapshotSignature.current = JSON.stringify(cached);
        if (cached.games.length) {
          setGames((current) => (current.length ? current : cached.games));
          setSelectedId((current) => current ?? cached.games[0].id);
        }
        if (cached.steamProfile) setSteamProfile((current) => current ?? cached.steamProfile);
      }
      // Hydrate local artwork first so the network refresh preserves the shelf.
      void loadGames();
    });
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

  /** PC đã nhận lệnh cài chưa. `id` dạng steam-<appid>, kể cả game vừa mua chưa có trong kệ. */
  const installGame = useCallback(async (id: string): Promise<InstallResult> => {
    if (installingId) return { ok: false, error: null };
    setInstallingId(id);
    setInstallOpenedId(null);
    setError(null);
    try {
      const result = await pcPostJson<{ ok?: boolean; error?: string; downloadAgent?: boolean }>(
        PC_ROUTES.gameInstall,
        { id },
        'Không mở được trình cài đặt Steam.',
      );
      // Có agent tải game: tiến trình đi thẳng về qua DataChannel. Không có (PC cũ)
      // thì Steam mở hộp thoại trên máy tính như trước.
      if (mounted.current && !result.downloadAgent) setInstallOpenedId(id);
      return { ok: true, error: null };
    } catch (installError) {
      const message = installError instanceof Error ? installError.message : 'Không mở được trình cài đặt Steam.';
      if (mounted.current) setError(message);
      return { ok: false, error: message };
    } finally {
      if (mounted.current) setInstallingId(null);
    }
  }, [installingId]);

  const installSelected = useCallback(
    async (): Promise<boolean> => (selected ? (await installGame(selected.id)).ok : false),
    [installGame, selected],
  );

  /** Nhờ Steam client trên PC gỡ game; tiến trình tiếp tục đi qua download agent. */
  const uninstallGame = useCallback(async (id: string): Promise<UninstallResult> => {
    if (uninstallingId || installingId || launchingId) return { ok: false, error: null };
    setUninstallingId(id);
    setError(null);
    try {
      await pcPostJson<{ ok?: boolean; error?: string; downloadAgent?: boolean }>(
        PC_ROUTES.gameUninstall,
        { id },
        'Không bắt đầu gỡ cài đặt được.',
      );
      return { ok: true, error: null };
    } catch (uninstallError) {
      const message = uninstallError instanceof Error ? uninstallError.message : 'Không bắt đầu gỡ cài đặt được.';
      return { ok: false, error: message };
    } finally {
      if (mounted.current) setUninstallingId(null);
    }
  }, [installingId, launchingId, uninstallingId]);

  const uninstallSelected = useCallback(
    async (): Promise<UninstallResult> => (selected ? uninstallGame(selected.id) : { ok: false, error: null }),
    [selected, uninstallGame],
  );

  return useMemo(() => ({
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
    uninstallingId,
    installOpenedId,
    launchSelected,
    installSelected,
    installGame,
    uninstallSelected,
    uninstallGame,
    achievements,
    achievementCache,
  }), [games, selected, loading, refreshing, reachable, error, libraryWarning, steamProfile,
    loadGames, launchingId, installingId, uninstallingId, installOpenedId, launchSelected,
    installSelected, installGame, uninstallSelected, uninstallGame, achievements]);
}

export type PcLibrary = ReturnType<typeof usePcLibrary>;
