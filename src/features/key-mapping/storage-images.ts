import { apiRequest } from '@/lib/api';
import { MAX_IMAGE_BYTES, screenshotMimeType, validateScreenshot } from './model';

export type StorageImageEntry = { name: string; path: string; isDir: boolean; size: number; modified: number };
export type ImageStorageMode = 'cloud' | 'local';
export function safeImageStoragePath(path: string): string {
  const clean = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (clean.includes('\0') || clean.split('/').some(part => part === '.' || part === '..' || part === '.trash')) throw new Error('Đường dẫn Storage không hợp lệ.');
  return clean;
}
export async function listStorageImages(path: string, signal?: AbortSignal, mode: ImageStorageMode = 'cloud'): Promise<StorageImageEntry[]> {
  const folder = safeImageStoragePath(path);
  return apiRequest(`/api/storage/tree?mode=${mode}&depth=1&fresh=1&path=${encodeURIComponent(folder)}`, { cache: 'no-store', signal }, async response => {
    if (response.status === 404) return [];
    const body = await response.json() as { ok?: boolean; nodes?: StorageImageEntry[]; error?: string };
    if (!response.ok || !body.ok || !Array.isArray(body.nodes)) throw new Error(body.error || 'Không đọc được ảnh trong Storage.');
    return body.nodes.filter(node => {
      if (!node || typeof node.path !== 'string' || typeof node.name !== 'string' || typeof node.isDir !== 'boolean') return false;
      try {
        const normalized = safeImageStoragePath(node.path);
        const parent = normalized.split('/').slice(0, -1).join('/');
        return normalized === node.path && parent === folder && (node.isDir || /\.(png|jpe?g|webp)$/i.test(node.name));
      } catch { return false; }
    }).sort((a, b) => Number(b.isDir) - Number(a.isDir) || b.modified - a.modified);
  });
}
/** Download through the app's existing authenticated API, not an unauthenticated URL. */
export async function readStorageImage(entry: StorageImageEntry, signal?: AbortSignal, mode: ImageStorageMode = 'cloud') {
  if (entry.isDir || !entry.path || entry.size > MAX_IMAGE_BYTES) throw new Error('Chọn một ảnh không quá 10 MB.');
  const path = safeImageStoragePath(entry.path);
  return apiRequest(`/api/storage/download?mode=${mode}&path=${encodeURIComponent(path)}`, { signal }, async response => {
    if (!response.ok) throw new Error('Không tải được ảnh từ Storage. Kiểm tra kết nối và thử lại.');
    if (Number(response.headers.get('Content-Length')) > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
    const bytes = await response.arrayBuffer();
    const mimeType = screenshotMimeType(bytes);
    validateScreenshot(bytes, mimeType ?? '');
    return { bytes, mimeType: mimeType! };
  });
}
