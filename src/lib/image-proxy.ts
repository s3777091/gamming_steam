// Ảnh Steam (steamstatic.com, akamaihd.net, ...) bị chặn ở Việt Nam: DNS của nhà
// mạng trả về địa chỉ giả nên ảnh bìa, hero, ảnh chụp màn hình trong Games, Store
// và tìm kiếm đều trống trơn trong khi dữ liệu (tên, giá) vẫn tải bình thường vì
// chúng đi qua backend Jetsona. API trả URL gốc của Steam nên app phải tự đưa ảnh
// qua một proxy ảnh công khai trước khi tải.
//
// PURE (không import react-native) để chạy được dưới `node --test`.

const DEFAULT_IMAGE_PROXY = 'https://wsrv.nl/';

const STEAM_IMAGE_SUFFIXES = [
  'steamstatic.com',
  'steampowered.com',
  'steamcommunity.com',
  'akamaihd.net',
  'steamcontent.com',
];

export function isSteamImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return STEAM_IMAGE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/**
 * URL ảnh để thực sự tải. Ảnh Steam được bọc qua proxy; mọi URL khác (Supabase,
 * Unsplash, data:, file:) giữ nguyên. `proxyBase` rỗng = tắt proxy.
 */
export function proxiedImageUrl(uri: string, proxyBase: string | null | undefined = DEFAULT_IMAGE_PROXY): string {
  if (!proxyBase) return uri;
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return uri;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return uri;
  if (!isSteamImageHost(parsed.hostname)) return uri;
  const base = proxyBase.endsWith('/') ? proxyBase : `${proxyBase}/`;
  return `${base}?url=${encodeURIComponent(parsed.toString())}`;
}
