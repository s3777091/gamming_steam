export type StoreReview = {
  id: string;
  author: string | null;
  avatar: string | null;
  recommended: boolean;
  text: string;
  language: string | null;
  votesUp: number;
  playtimeHours: number | null;
  postedAt: string | null;
};

export type SteamStoreGameDetail = {
  appId: number;
  name: string;
  shortDescription: string | null;
  about: string | null;
  headerImage: string | null;
  backgroundImage: string | null;
  portraitImage: string | null;
  logo: { url: string; width: number; height: number } | null;
  website: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  categories: string[];
  releaseDate: string | null;
  comingSoon: boolean;
  isFree: boolean;
  price: {
    currency: string | null;
    original: number | null;
    final: number | null;
    discountPercent: number;
  };
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  controllerSupport: 'full' | 'partial' | null;
  requiredAge: number | null;
  languages: Array<{ name: string; fullAudio: boolean }>;
  requirements: {
    minimum: Array<{ label: string | null; value: string }>;
    recommended: Array<{ label: string | null; value: string }>;
  };
  storageSize: string | null;
  achievementCount: number | null;
  legalNotice: string | null;
  recommendations: number | null;
  metacriticScore: number | null;
  metacriticUrl: string | null;
  screenshots: Array<{ id: number; thumbnail: string; full: string }>;
  contentNotice: string | null;
  reviewSummary: { label: string | null; positive: number; negative: number; total: number } | null;
  reviews: StoreReview[];
  news: Array<{
    id: string;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    feedLabel: string | null;
    publishedAt: string | null;
  }>;
  storeUrl: string;
};

// Phan cua SteamStoreItem ma trang can khi chi tiet chua tai xong.
export type StoreDetailItem = {
  appId: number;
  name: string;
  discounted: boolean;
  discountPercent: number;
  largeImage: string;
  headerImage: string;
  portraitImage?: string | null;
  controllerSupport: 'full' | 'partial' | null;
  storeUrl: string;
  genres?: string[];
  logo?: { url: string; width: number; height: number } | null;
};

export type DetailSheet =
  | { kind: 'about' }
  | { kind: 'news'; index: number | null; fromList?: boolean }
  | { kind: 'reviews' }
  | { kind: 'review'; id: string }
  | { kind: 'screenshots'; index: number }
  | { kind: 'languages' }
  | { kind: 'requirements' }
  | { kind: 'legal' }
  | { kind: 'content' };

/** Values derived once in StoreGameDetail and shared by its sections and sheets. */
export type DetailView = {
  detail: SteamStoreGameDetail;
  name: string;
  genres: string[];
  controllerSupport: 'full' | 'partial' | null;
  languages: SteamStoreGameDetail['languages'];
  hasVietnamese: boolean;
  summary: SteamStoreGameDetail['reviewSummary'];
  positivePercent: number | null;
  openSheet: (sheet: DetailSheet) => void;
};
