// Ảnh chụp game: lưu vào ổ D của PC (D:\jetsona\storage\Images\Ảnh chụp game)
// qua chính route /api/storage của web ở chế độ `local`. Server web proxy chế độ
// này về dịch vụ local-storage trên PC (services/local-storage), nên ảnh nằm cùng
// chỗ với file tải lên từ Storage console và xem lại được cả trên web lẫn trong
// hồ sơ trên app.

import { apiRequest, getApiAuthHeaders } from '@/lib/api';
import { backendUrl } from '@/lib/config';

/** Thư mục con dưới gốc storage (POSIX, như API storage dùng). */
export const SCREENSHOT_FOLDER = 'Images/Ảnh chụp game';

export type GameScreenshot = {
  name: string;
  path: string;
  size: number;
  modified: number;
};

type StorageNode = GameScreenshot & { isDir: boolean };

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-10-15 21-36-05": sắp theo tên cũng là sắp theo thời gian. */
function timestamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/** Tên game thành tên file hợp lệ trên Windows. */
function fileSafe(title: string): string {
  const clean = title
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 60);
  return clean || 'Jetsona';
}

/** Gửi một ảnh PNG (base64) lên PC. Trả về file đã lưu. */
export async function uploadGameScreenshot(base64Png: string, gameTitle: string): Promise<GameScreenshot> {
  const form = new FormData();
  form.append('target', SCREENSHOT_FOLDER);
  // Android: FormData của React Native đọc thẳng data: URI, không cần ghi file tạm.
  form.append('files', {
    uri: `data:image/png;base64,${base64Png}`,
    name: `${fileSafe(gameTitle)} ${timestamp(new Date())}.png`,
    type: 'image/png',
  } as unknown as Blob);

  return apiRequest('/api/storage/upload?mode=local', { method: 'POST', body: form }, async (response) => {
    const data = await response.json().catch(() => null) as
      { ok?: boolean; error?: string; items?: GameScreenshot[] } | null;
    const saved = data?.items?.[0];
    if (!response.ok || !data?.ok || !saved) {
      throw new Error(data?.error || 'Không lưu được ảnh chụp vào máy tính.');
    }
    return saved;
  });
}

/** Ảnh chụp đã lưu, mới nhất trước. Thư mục chưa có (chưa chụp lần nào) là danh sách rỗng. */
export async function listGameScreenshots(signal?: AbortSignal): Promise<GameScreenshot[]> {
  const query = `mode=local&depth=1&fresh=1&path=${encodeURIComponent(SCREENSHOT_FOLDER)}`;
  return apiRequest(`/api/storage/tree?${query}`, { cache: 'no-store', signal }, async (response) => {
    if (response.status === 404) return [];
    const data = await response.json().catch(() => null) as
      { ok?: boolean; error?: string; nodes?: StorageNode[] } | null;
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Không đọc được ảnh chụp trên máy tính.');
    return (data.nodes ?? [])
      .filter((node) => !node.isDir && /\.(png|jpe?g|webp)$/i.test(node.name))
      .sort((a, b) => b.modified - a.modified)
      .map(({ name, path, size, modified }) => ({ name, path, size, modified }));
  });
}

/** Header đăng nhập cho route download (lấy một lần cho cả lưới ảnh). */
export const screenshotAuthHeaders = getApiAuthHeaders;

/** Nguồn ảnh cho expo-image: route download cần đúng phiên Supabase của app. */
export function screenshotImageSource(path: string, headers: Record<string, string>) {
  return {
    uri: backendUrl(`/api/storage/download?mode=local&path=${encodeURIComponent(path)}`),
    headers,
    // Token đổi theo phiên; khoá cache theo file để không tải lại ảnh đã có.
    cacheKey: `jetsona-screenshot:${path}`,
  };
}
