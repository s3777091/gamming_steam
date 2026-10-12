// Chế độ xem thử giao diện KHÔNG cần đăng nhập hay máy tính ở nhà: dữ liệu mẫu
// dùng ảnh Steam thật. Chỉ bật khi build có EXPO_PUBLIC_UI_DEMO=1 (dùng để chụp
// màn hình và kiểm tra bố cục trên máy ảo); bản phát hành không bật cờ này.

export const UI_DEMO = process.env.EXPO_PUBLIC_UI_DEMO === '1';

const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const art = (id: number) => ({
  artworkUrl: `${CDN}/${id}/library_hero.jpg`,
  heroUrl: `${CDN}/${id}/library_hero.jpg`,
});

const GAMES = [
  { id: 'steam-2277560', title: 'Where Winds Meet', appId: 2277560, developer: 'Everstone Studio', genres: ['Hành động', 'Thế giới mở'] },
  { id: 'steam-1328670', title: 'Mass Effect Legendary Edition', appId: 1328670, developer: 'BioWare', genres: ['RPG', 'Hành động'] },
  { id: 'steam-457140', title: 'Oxygen Not Included', appId: 457140, developer: 'Klei Entertainment', genres: ['Mô phỏng', 'Chiến lược'] },
  { id: 'steam-1174180', title: 'Red Dead Redemption 2', appId: 1174180, developer: 'Rockstar Games', genres: ['Hành động', 'Phiêu lưu'] },
  { id: 'steam-779340', title: 'Total War: THREE KINGDOMS', appId: 779340, developer: 'CREATIVE ASSEMBLY', genres: ['Chiến lược'] },
  { id: 'steam-289070', title: "Sid Meier's Civilization VI", appId: 289070, developer: 'Firaxis Games', genres: ['Chiến lược'] },
  { id: 'steam-1091500', title: 'Cyberpunk 2077', appId: 1091500, developer: 'CD PROJEKT RED', genres: ['RPG'] },
].map((game) => ({
  id: game.id,
  title: game.title,
  source: 'Steam',
  steamAppId: String(game.appId),
  installed: true,
  ...art(game.appId),
  sizeBytes: 54 * 1024 ** 3,
  lastPlayed: '2026-10-10T12:00:00Z',
  description: 'Dữ liệu mẫu để xem bố cục giao diện.',
  developer: game.developer,
  publisher: game.developer,
  genres: game.genres,
  releaseDate: '2025',
  storeUrl: `https://store.steampowered.com/app/${game.appId}/`,
  art: { logoUrl: `${CDN}/${game.appId}/logo.png`, logoWidth: 640, logoHeight: 360 },
}));

const storeItem = (appId: number, name: string, price: number, discount = 0) => ({
  appId,
  name,
  discounted: discount > 0,
  discountPercent: discount,
  originalPrice: price,
  finalPrice: Math.round(price * (1 - discount / 100)),
  currency: 'VND',
  largeImage: `${CDN}/${appId}/header.jpg`,
  smallImage: `${CDN}/${appId}/capsule_184x69.jpg`,
  headerImage: `${CDN}/${appId}/header.jpg`,
  portraitImage: `${CDN}/${appId}/library_600x900.jpg`,
  controllerSupport: 'full' as const,
  storeUrl: `https://store.steampowered.com/app/${appId}/`,
  backgroundImage: `${CDN}/${appId}/library_hero.jpg`,
  shortDescription: 'ARC Raiders là cuộc phiêu lưu khai thác nhiều người chơi, đặt trong một tương lai chết chóc nơi Trái Đất bị tàn phá bởi mối đe dọa cơ giới.',
  genres: ['Hành động', 'Bắn súng'],
  logo: { url: `${CDN}/${appId}/logo.png`, width: 640, height: 360 },
});

const STORE = {
  ok: true,
  featured: storeItem(1808500, 'ARC Raiders', 37000000, 50),
  specials: [
    storeItem(1174180, 'Red Dead Redemption 2', 98000000, 75),
    storeItem(1328670, 'Japanese Ramen Simulator', 12000000, 15),
    storeItem(1091500, 'Hood Warfare 2', 25000000, 10),
  ],
  topSellers: [
    storeItem(703080, 'Planet Zoo 2', 74000000),
    storeItem(1086940, 'Steam Machine', 0),
    storeItem(1172470, 'STAR WARS: Galactic Racer', 52000000),
    storeItem(1245620, 'WARDOGS', 31000000),
    storeItem(2358720, 'Steam Deck', 0),
  ],
  newReleases: [],
  promotions: [{ name: 'ƯU ĐÃI CUỐI TUẦN', image: `${CDN}/1174180/library_hero.jpg`, storeUrl: 'https://store.steampowered.com/' }],
};

const PROFILE = {
  ok: true,
  profile: {
    steamId: '1', personaName: 'Thỏ Ngọc Có Râu', profileUrl: 'https://steamcommunity.com/', avatarUrl: null,
    personState: 1, gameExtraInfo: null, lastLogoff: null, realName: null, countryCode: 'VN', createdAt: null,
    profilePublic: true, level: 6, xp: 100, xpForCurrentLevel: 0, xpNeededToLevelUp: 100,
    ownedGames: 10, totalPlaytimeMinutes: 62700, friends: 5, recentGames: [],
  },
};

const ACHIEVEMENTS = { ok: true, appId: 2277560, supported: true, total: 67, unlocked: 10, achievements: [] };

/** Trả dữ liệu mẫu cho một đường dẫn của API máy tính, hoặc null khi không có mẫu. */
export function demoResponse(path: string): unknown | null {
  if (path.startsWith('/games/') && path.endsWith('/achievements')) return ACHIEVEMENTS;
  if (path.startsWith('/games/') && path.endsWith('/news')) return { ok: true, items: [] };
  if (path === '/games') return { ok: true, games: GAMES, steamProfile: PROFILE.profile };
  if (path === '/store') return STORE;
  if (path.startsWith('/store/search')) return { ok: true, total: 8, items: [...STORE.specials, ...STORE.topSellers] };
  if (path.startsWith('/store/')) return { ok: false, error: 'Dữ liệu mẫu không có chi tiết game.' };
  if (path === '/steam/profile') return PROFILE;
  return null;
}
