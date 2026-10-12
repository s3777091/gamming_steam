// Chuẩn hoá URL avatar Storage. Port từ jetsona-ui-hybrid/src/lib/profile-avatar.ts,
// thêm resolveProfileAvatarUri cho RN.
//
// Avatar nằm trong bucket public `avatars`, được MỌI edge Jetsona proxy. Lưu cả
// hostname thì người xem ở edge khác (cn.protexa.cloud) sẽ đi thẳng về origin đã
// ghi trong URL (vn.protexa.cloud) — đúng con đường mà edge HK sinh ra để né GFW.
// Vì vậy dạng chuẩn lưu trong DB và gửi qua signalling là ĐƯỜNG DẪN TƯƠNG ĐỐI.
// Migration 202608100001 đã backfill các row cũ về dạng này.
//
// Khác bản web: <img> của trình duyệt tự hiểu path tương đối theo origin đang mở,
// còn <Image> của React Native KHÔNG có origin — path tương đối sẽ im lặng không
// load. Nên phải ghép base URL của region đang hoạt động ngay trước khi render
// (resolveProfileAvatarUri).
//
// Module này PURE (không import @/lib/config hay react-native) để chạy được dưới
// `node --test`; nơi gọi tự truyền base URL vào.

const PUBLIC_AVATAR_PREFIX = '/storage/v1/object/public/avatars/';

/**
 * Dạng chuẩn để LƯU (DB, user metadata) và GỬI QUA DÂY (signalling watch party):
 * đường dẫn tương đối, không ghim host.
 */
export function normalizeProfileAvatarUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (candidate.startsWith(PUBLIC_AVATAR_PREFIX)) return candidate;

  try {
    const parsed = new URL(candidate);
    if (parsed.pathname.startsWith(PUBLIC_AVATAR_PREFIX)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Không phải URL (metadata tự do) — giữ nguyên, nhánh fallback chữ cái lo.
  }
  return candidate;
}

/** Gắn ?v= để phá cache sau khi upload đè, trên dạng đã chuẩn hoá. */
export function versionProfileAvatarUrl(publicUrl: string, version: number): string {
  const normalized = normalizeProfileAvatarUrl(publicUrl) ?? publicUrl;
  return `${normalized}${normalized.includes('?') ? '&' : '?'}v=${version}`;
}

/**
 * Dạng tuyệt đối để đưa vào `<Image source={{ uri }}>`. Chuẩn hoá trước (chịu
 * được cả row cũ còn ghim host), rồi ghép base URL của region đang hoạt động —
 * nhờ vậy viewer CN tải avatar qua edge HK thay vì đâm thẳng về VN.
 *
 * Trả `null` khi không có avatar, để nơi gọi rơi về chữ cái đầu.
 */
export function resolveProfileAvatarUri(
  value: string | null | undefined,
  baseUrl: string,
): string | null {
  const normalized = normalizeProfileAvatarUrl(value);
  if (!normalized) return null;
  // Chỉ path tương đối mới cần ghép; data:/file:/URL ngoài giữ nguyên.
  if (!normalized.startsWith('/')) return normalized;
  return `${baseUrl.replace(/\/+$/, '')}${normalized}`;
}
