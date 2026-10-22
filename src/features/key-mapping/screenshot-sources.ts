import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ensurePhotoLibraryPermission } from './photo-permissions';
import { MAX_IMAGE_BYTES, screenshotMimeType, validateScreenshot } from './model';
import { readStorageImage, type ImageStorageMode, type StorageImageEntry } from './storage-images';

export type ScreenshotSelection = {
  uri: string; width: number; height: number; fileSize: number; mimeType: string;
  origin: 'device' | 'storage'; name: string;
};
function validateDimensions(width: number, height: number) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0 && n <= 16384)) throw new Error('Ảnh phải có kích thước hợp lệ, mỗi cạnh không quá 16384 px.');
}
export async function pickDeviceScreenshot(): Promise<ScreenshotSelection | null> {
  await ensurePhotoLibraryPermission();
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  validateDimensions(asset.width, asset.height);
  const file = new File(asset.uri);
  if (file.size > MAX_IMAGE_BYTES || (asset.fileSize ?? 0) > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
  const bytes = await file.arrayBuffer();
  const mimeType = screenshotMimeType(bytes);
  validateScreenshot(bytes, mimeType ?? '');
  return { uri: asset.uri, width: asset.width, height: asset.height, fileSize: bytes.byteLength, mimeType: mimeType!, name: asset.fileName ?? 'Ảnh từ thư viện', origin: 'device' };
}
export async function prepareStorageScreenshot(entry: StorageImageEntry, signal?: AbortSignal, mode: ImageStorageMode = 'cloud'): Promise<ScreenshotSelection> {
  const { bytes, mimeType } = await readStorageImage(entry, signal, mode);
  if (signal?.aborted) throw new Error('Đã hủy chọn ảnh.');
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice(6);
  const file = new File(Paths.cache, `mapping-source-${Crypto.randomUUID()}.${extension}`);
  try {
    file.write(new Uint8Array(bytes));
    const image = await Image.loadAsync(file.uri);
    let width: number; let height: number;
    try { width = image.width * image.scale; height = image.height * image.scale; }
    finally { image.release(); }
    validateDimensions(width, height);
    if (signal?.aborted) throw new Error('Đã hủy chọn ảnh.');
    return { uri: file.uri, width, height, mimeType, fileSize: bytes.byteLength, origin: 'storage', name: entry.name };
  } catch (error) { if (file.exists) file.delete(); throw error; }
}
/** Only delete cache files created here, never a device-library asset or source Storage file. */
export function releaseStorageScreenshot(uri: string) {
  try {
    const file = new File(uri);
    if (file.parentDirectory.uri.replace(/\/+$/, '') === Paths.cache.uri.replace(/\/+$/, '') && file.name.startsWith('mapping-source-') && file.exists) file.delete();
  } catch { /* The cache may already have been evicted by the OS. */ }
}
