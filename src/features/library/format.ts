import type { SteamProfile, SteamStoreItem } from './types';

// personastate của Steam Web API.
export const PERSONA_STATE_LABEL = ['Ngoại tuyến', 'Trực tuyến', 'Bận', 'Vắng mặt', 'Đang ngủ', 'Muốn trao đổi', 'Muốn chơi'];

// Hermes (React Native) có Intl nhưng không phải bản dựng nào cũng đủ locale,
// nên mọi định dạng đi qua một lớp bọc rơi về cách tự viết khi Intl thiếu.
function groupDigits(value: number, fractionDigits = 0): string {
  const fixed = value.toFixed(fractionDigits);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction ? `${grouped},${fraction}` : grouped;
}

export function formatNumber(value: number): string {
  return groupDigits(value);
}

export function formatHours(minutes: number | null): string | null {
  if (minutes === null) return null;
  const hours = minutes / 60;
  return `${groupDigits(hours, hours < 10 ? 1 : 0).replace(/,0$/, '')} giờ`;
}

export function formatClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function steamPresence(profile: SteamProfile | null): string {
  if (!profile) return 'Steam';
  if (profile.gameExtraInfo) return `Đang chơi ${profile.gameExtraInfo}`;
  return profile.personState > 0 ? 'Đang trực tuyến' : 'Ngoại tuyến';
}

export function formatSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const gib = bytes / 1024 ** 3;
  return `${gib >= 10 ? gib.toFixed(0) : gib.toFixed(1)} GB`;
}

/** dd/mm/yyyy cho ngày mở khoá achievement và bài tin. */
export function formatShortDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Giá theo đồng Steam trả về (đơn vị nhỏ nhất = /100). Không đoán khi thiếu tiền tệ. */
export function formatStorePrice(item: Pick<SteamStoreItem, 'finalPrice' | 'currency'>): string {
  if (item.finalPrice === 0) return 'Miễn phí';
  if (item.finalPrice === null || !item.currency) return 'Xem giá';
  const amount = item.finalPrice / 100;
  switch (item.currency) {
    case 'VND': return `${groupDigits(Math.round(amount))} ₫`;
    case 'USD': return `$${groupDigits(amount, amount % 1 ? 2 : 0)}`;
    case 'EUR': return `${groupDigits(amount, 2)} €`;
    default: return `${groupDigits(Math.round(amount))} ${item.currency}`;
  }
}

export function formatRelative(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const seconds = Math.round((Date.now() - time) / 1000);
  const abs = Math.abs(seconds);
  const suffix = seconds >= 0 ? 'trước' : 'nữa';
  const unit = (n: number, label: string) => `${n} ${label} ${suffix}`;
  if (abs < 60) return 'Vừa xong';
  if (abs < 3600) return unit(Math.round(abs / 60), 'phút');
  if (abs < 86_400) return unit(Math.round(abs / 3600), 'giờ');
  if (abs < 30 * 86_400) return unit(Math.round(abs / 86_400), 'ngày');
  if (abs < 365 * 86_400) return unit(Math.round(abs / (30 * 86_400)), 'tháng');
  return unit(Math.round(abs / (365 * 86_400)), 'năm');
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${groupDigits(value / 1_000_000, 1).replace(/,0$/, '')} Tr`;
  if (value >= 1_000) return `${groupDigits(value / 1_000, 1).replace(/,0$/, '')} N`;
  return String(value);
}

export function isSteamAppId(value: string | null | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value));
}

/** Trích xuất ảnh đầu tiên (nếu có) từ nội dung bản tin Steam thô */
export function extractSteamImage(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const clanMatch = value.match(/\{STEAM_CLAN_IMAGE\}\/([^\s"'\]]+)/i);
  if (clanMatch) {
    return `https://clan.akamai.steamstatic.com/images/${clanMatch[1]}`;
  }
  const urlMatch = value.match(/(?:\[img[^\]]*\]|<img[^>]+src=["']?)(https?:\/\/[^\s"'\]>]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  return null;
}

/**
 * Làm sạch hoàn toàn văn bản bản tin Steam:
 * Loại bỏ toàn bộ thẻ BBCode, HTML, mã ảnh lỗi như `[img src="`, clan images và ký tự thực thể.
 */
export function cleanSteamText(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  return value
    // 1. Thẻ ảnh / video BBCode có cặp đóng mở
    .replace(/\[(?:img|image|previewyoutube|youtube)(?:=[^\]]*)?\][\s\S]*?\[\/(?:img|image|previewyoutube|youtube)\]/gi, ' ')
    // 2. Thẻ ảnh đơn [img ...], [image ...], <img ... />
    .replace(/\[\/?(?:img|image)(?:\s+[^\]]*)?\]/gi, ' ')
    .replace(/<img\b[^>]*\/?>/gi, ' ')
    // 3. Xóa placeholder Clan image
    .replace(/\{STEAM_CLAN_IMAGE\}\/\S+/gi, ' ')
    // 4. Xóa các đoạn tag dở dang / cụt như `[img src="` hay `[img`
    .replace(/\[img\s+src=["']?/gi, ' ')
    .replace(/\[\/?img\b[^\]\n]*\]/gi, ' ')
    // 5. Chuyển xuống dòng
    .replace(/\[\/?(?:p|h1|h2|h3|quote|list|olist|table|tr)(?:=[^\]]*)?\]/gi, '\n')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
    // 6. Xóa toàn bộ BBCode còn lại như [b], [/b], [url=...], [/url], [*]
    .replace(/\[\/?[a-z0-9_*-]+(?:\s*=[^\]\n]*)?(?:\s+[^\]\n]*)?\]/gi, ' ')
    // 7. Xóa toàn bộ thẻ HTML còn lại
    .replace(/<[^>]+>/g, ' ')
    // 8. Giải mã HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    // 9. Dấu câu và khoảng trắng
    .replace(/[—–]/g, '-')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

