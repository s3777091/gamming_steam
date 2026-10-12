import type { SteamStoreGameDetail } from './detail-types';

export type PcGame = {
  id: string;
  title: string;
  source: 'Steam' | 'PC' | string;
  steamAppId?: string | null;
  installed?: boolean;
  artworkUrl: string;
  heroUrl: string;
  sizeBytes: number | null;
  lastPlayed: string | null;
  description?: string | null;
  developer?: string | null;
  publisher?: string | null;
  genres?: string[];
  releaseDate?: string | null;
  storeUrl?: string | null;
  art?: PcGameArt | null;
};

/** Publisher logo mirrored by deploy/pc/game-art and served from Supabase Storage. */
export type PcGameArt = {
  logoUrl: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
};

export type GameResponse = {
  ok?: boolean;
  games?: PcGame[];
  steamProfile?: SteamProfile | null;
  steamWarning?: string | null;
  error?: string;
};

export type SteamProfile = {
  steamId: string;
  personaName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  personState: number;
  gameExtraInfo: string | null;
  lastLogoff: string | null;
};

export type SteamUserDetails = SteamProfile & {
  realName: string | null;
  countryCode: string | null;
  createdAt: string | null;
  profilePublic: boolean;
  level: number | null;
  xp: number | null;
  xpForCurrentLevel: number | null;
  xpNeededToLevelUp: number | null;
  ownedGames: number | null;
  totalPlaytimeMinutes: number | null;
  friends: number | null;
  recentGames: Array<{
    appId: number;
    name: string;
    iconUrl: string | null;
    playtime2WeeksMinutes: number;
    playtimeMinutes: number;
  }>;
};

export type SteamProfileResponse = {
  ok?: boolean;
  profile?: SteamUserDetails;
  error?: string;
};

export type SteamAchievement = {
  apiName: string;
  name: string;
  description: string | null;
  unlocked: boolean;
  unlockTime: string | null;
  iconUrl: string | null;
  hidden: boolean;
};

export type ProfileAchievement = SteamAchievement & {
  appId: number;
  gameName: string;
  gameIconUrl: string | null;
};

export type AchievementResponse = {
  ok?: boolean;
  appId?: number;
  gameName?: string | null;
  supported?: boolean;
  total?: number;
  unlocked?: number;
  achievements?: SteamAchievement[];
  error?: string;
};

export type SteamNewsItem = {
  id: string;
  title: string;
  url: string | null;
  author: string | null;
  summary: string | null;
  feedLabel: string | null;
  publishedAt: string | null;
};

export type NewsResponse = {
  ok?: boolean;
  appId?: number;
  items?: SteamNewsItem[];
  error?: string;
};

export type StoreTab = 'games' | 'store';

export type SteamStoreItem = {
  appId: number;
  name: string;
  discounted: boolean;
  discountPercent: number;
  originalPrice: number | null;
  finalPrice: number | null;
  currency: string | null;
  largeImage: string;
  smallImage: string;
  headerImage: string;
  portraitImage?: string | null;
  controllerSupport: 'full' | 'partial' | null;
  storeUrl: string;
  backgroundImage?: string | null;
  shortDescription?: string | null;
  genres?: string[];
  logo?: { url: string; width: number; height: number } | null;
};

export type SteamPromotion = {
  name: string;
  image: string;
  storeUrl: string;
};

export type StoreResponse = {
  ok?: boolean;
  featured?: SteamStoreItem | null;
  specials?: SteamStoreItem[];
  topSellers?: SteamStoreItem[];
  newReleases?: SteamStoreItem[];
  promotions?: SteamPromotion[];
  fetchedAt?: string;
  error?: string;
};

export type StoreSearchResponse = {
  ok?: boolean;
  total?: number;
  items?: SteamStoreItem[];
  error?: string;
};

export type StoreDetailResponse = {
  ok?: boolean;
  game?: SteamStoreGameDetail;
  error?: string;
};

/** Side panels over the library; only one is open at a time. */
export type LibraryPanel = 'info' | 'news' | 'achievements' | 'profile';
