import { useCallback, useRef, useState, type MutableRefObject } from 'react';

import { isSteamAppId } from './format';
import type { AchievementResponse, PcGame, ProfileAchievement, SteamProfileResponse, SteamUserDetails } from './types';
import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { fetchAchievements } from './usePcLibrary';

const lastPlayedTime = (game: PcGame) => Date.parse(game.lastPlayed || '') || 0;

/** Installed Steam games to read achievements from: Steam's recent order first, then last played. */
function activityCandidates(games: PcGame[], profile: SteamUserDetails): PcGame[] {
  const recentOrder = new Map(profile.recentGames.map((game, index) => [game.appId, index]));
  return games
    .filter((game) => game.installed === true && isSteamAppId(game.steamAppId))
    .sort((a, b) => {
      const aOrder = recentOrder.get(Number(a.steamAppId));
      const bOrder = recentOrder.get(Number(b.steamAppId));
      if (aOrder !== undefined || bOrder !== undefined) {
        return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
      }
      return lastPlayedTime(b) - lastPlayedTime(a);
    })
    .slice(0, 4);
}

/** Steam account details plus the newest achievements unlocked across installed games. */
export function useSteamProfile(games: PcGame[], achievementCache: MutableRefObject<Map<number, AchievementResponse>>) {
  const [details, setDetails] = useState<SteamUserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);
  const activityRequestId = useRef(0);

  const loadAchievements = useCallback(async (profile: SteamUserDetails) => {
    const requestId = ++activityRequestId.current;
    const candidates = activityCandidates(games, profile);

    setAchievements([]);
    setAchievementsError(null);
    if (!candidates.length) {
      setAchievementsLoading(false);
      return;
    }

    setAchievementsLoading(true);
    try {
      const results = await Promise.all(candidates.map(async (game) => {
        try {
          const appId = Number(game.steamAppId);
          const cached = achievementCache.current.get(appId);
          if (cached) return { game, data: cached };

          const data = await fetchAchievements(appId);
          achievementCache.current.set(appId, data);
          return { game, data };
        } catch {
          return null;
        }
      }));
      if (requestId !== activityRequestId.current) return;
      if (results.every((result) => result === null)) {
        setAchievementsError('Steam chưa cho phép đọc achievement của các game đã cài.');
      }

      const latest = results
        .filter((result): result is NonNullable<typeof result> => result !== null)
        .flatMap(({ game, data }) => (data.achievements || [])
          .filter((achievement) => achievement.unlocked && achievement.unlockTime)
          .map((achievement): ProfileAchievement => ({
            ...achievement,
            appId: Number(game.steamAppId),
            gameName: data.gameName || game.title,
            gameIconUrl: profile.recentGames.find((recent) => recent.appId === Number(game.steamAppId))?.iconUrl || null,
          })))
        .sort((a, b) => (Date.parse(b.unlockTime || '') || 0) - (Date.parse(a.unlockTime || '') || 0))
        .slice(0, 8);
      setAchievements(latest);
    } catch {
      if (requestId === activityRequestId.current) {
        setAchievementsError('Không tải được achievement gần đây.');
      }
    } finally {
      if (requestId === activityRequestId.current) setAchievementsLoading(false);
    }
  }, [achievementCache, games]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await pcFetchJson<SteamProfileResponse>(
        PC_ROUTES.steamProfile,
        'Không tải được hồ sơ Steam.',
        (body) => Boolean(body.profile),
      );
      setDetails(data.profile!);
      void loadAchievements(data.profile!);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ Steam.');
    } finally {
      setLoading(false);
    }
  }, [loadAchievements]);

  return { details, loading, error, achievements, achievementsLoading, achievementsError, load };
}

export type SteamProfileState = ReturnType<typeof useSteamProfile>;
