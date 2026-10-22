import type { SupabaseClient } from '@supabase/supabase-js';
import { validateScreenshot, validateProfile, type MappingProfile } from './model';

export const MAPPING_BUCKET = 'key-mapping-screenshots';
export type ScreenshotUpload = { bytes: ArrayBuffer; mime: string };
export type SavedProfile = { profile: MappingProfile; warning: string | null };
type CacheEntry = { at: number; profiles: MappingProfile[] };
function mappingError(error: { code?: string; message?: string } | null, fallback: string): Error {
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    return new Error('Thiết lập nút chưa sẵn sàng trên máy chủ. Vui lòng liên hệ quản trị viên để cập nhật dịch vụ rồi tải lại profile.');
  }
  return new Error(`${fallback}: ${error?.message ?? 'Không có dữ liệu trả về.'}`);
}
/** User-scoped memory cache only. Supabase remains the persistent source. */
export class MappingRepository {
  private cache = new Map<string, CacheEntry>();
  constructor(privateClient: SupabaseClient) { this.client = privateClient; }
  private client: SupabaseClient;
  private async owner(expected: string) {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session || data.session.user.id !== expected) {
      this.cache.clear(); throw new Error('Phiên đăng nhập đã thay đổi. Hãy mở lại mapping.');
    }
  }
  invalidate(userId: string) { this.cache.delete(userId); }
  async list(userId: string, fresh = false): Promise<MappingProfile[]> {
    await this.owner(userId);
    const cached = this.cache.get(userId);
    if (!fresh && cached && Date.now() - cached.at < 30_000) return cached.profiles;
    const { data, error } = await this.client.from('key_mapping_profiles').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) { this.invalidate(userId); throw mappingError(error, 'Không tải được mapping'); }
    const profiles = (data ?? []) as MappingProfile[];
    profiles.forEach(p => { validateProfile(p); this.checkPath(p); });
    this.cache.set(userId, { at: Date.now(), profiles });
    return profiles;
  }
  async load(userId: string, id: string): Promise<MappingProfile> {
    const profile = (await this.list(userId, true)).find(p => p.id === id);
    if (!profile) throw new Error('Profile đã bị xóa hoặc bạn không có quyền truy cập.');
    return profile;
  }
  private checkPath(profile: MappingProfile) {
    if (!profile.screenshot_path.startsWith(`${profile.user_id}/${profile.id}/`) || profile.screenshot_path.includes('..')) throw new Error('Đường dẫn ảnh không hợp lệ.');
  }
  async screenshotUrl(profile: MappingProfile) {
    await this.owner(profile.user_id); this.checkPath(profile);
    const { data, error } = await this.client.storage.from(MAPPING_BUCKET).createSignedUrl(profile.screenshot_path, 3600);
    if (error || !data?.signedUrl) throw new Error('Ảnh không còn tồn tại hoặc không tải được. Hãy thay ảnh.');
    return data.signedUrl;
  }
  private async removeObject(path: string): Promise<string | null> {
    try {
      const { error } = await this.client.storage.from(MAPPING_BUCKET).remove([path]);
      return error ? `Chưa xóa được ảnh cũ: ${error.message}` : null;
    } catch { return 'Chưa xóa được ảnh cũ. Hãy thử lại khi có mạng.'; }
  }
  private async removeUnreferenced(path: string, userId: string): Promise<string | null> {
    // A network failure may hide a committed insert. Never delete its screenshot.
    try {
      const { data, error } = await this.client.from('key_mapping_profiles').select('id').eq('user_id', userId).eq('screenshot_path', path);
      if (error) return 'Chưa xác minh được kết quả lưu; ảnh được giữ lại. Hãy tải lại profile.';
      if (data?.length) return null;
      return this.removeObject(path);
    } catch { return 'Chưa xác minh được kết quả lưu; ảnh được giữ lại. Hãy tải lại profile.'; }
  }
  async save(profile: MappingProfile, previous: MappingProfile | null, upload?: ScreenshotUpload, objectId?: string): Promise<SavedProfile> {
    validateProfile(profile); await this.owner(profile.user_id);
    if (previous && (previous.id !== profile.id || previous.user_id !== profile.user_id)) throw new Error('Không thể thay đổi chủ sở hữu profile.');
    let uploaded: string | null = null;
    const next = { ...profile, name: profile.name.trim() };
    if (upload) {
      validateScreenshot(upload.bytes, upload.mime);
      if (!objectId) throw new Error('Thiếu ID ảnh.');
      const extension = upload.mime === 'image/jpeg' ? 'jpg' : upload.mime.slice(6);
      const path = `${profile.user_id}/${profile.id}/${objectId}.${extension}`;
      const { error } = await this.client.storage.from(MAPPING_BUCKET).upload(path, upload.bytes, { contentType: upload.mime, upsert: false });
      if (error) throw new Error(`Không tải ảnh lên được: ${error.message}`);
      uploaded = path; next.screenshot_path = path;
    }
    try {
      this.checkPath(next);
      if (!previous && !uploaded) throw new Error('Cần tải ảnh lên trước khi lưu profile mới.');
      // Existing rows use compare-and-swap to protect edits from another device.
      const payload = {
        id: next.id, user_id: next.user_id, game_id: next.game_id, game_title: next.game_title,
        name: next.name, description: next.description, screenshot_path: next.screenshot_path,
        screenshot: next.screenshot, bindings: next.bindings, settings: next.settings, schema_version: 1,
      };
      const query = previous
        ? this.client.from('key_mapping_profiles').update(payload).eq('id', next.id).eq('user_id', next.user_id).eq('updated_at', previous.updated_at)
        : this.client.from('key_mapping_profiles').insert(payload);
      const { data, error } = await query.select('*').single();
      if (error || !data) throw error?.code === 'PGRST116' ? new Error('Profile đã thay đổi trên thiết bị khác. Hãy mở lại trước khi lưu.') : mappingError(error, 'Không lưu được mapping');
      this.invalidate(next.user_id);
      const warning = previous && previous.screenshot_path !== next.screenshot_path ? await this.removeObject(previous.screenshot_path) : null;
      return { profile: data as MappingProfile, warning };
    } catch (error) {
      const warning = uploaded ? await this.removeUnreferenced(uploaded, next.user_id) : null;
      if (warning) throw new Error(`${error instanceof Error ? error.message : String(error)} ${warning}`);
      throw error;
    }
  }
  async delete(profile: MappingProfile): Promise<string | null> {
    await this.owner(profile.user_id); this.checkPath(profile);
    const { data, error } = await this.client.from('key_mapping_profiles').delete().eq('id', profile.id).eq('user_id', profile.user_id).eq('updated_at', profile.updated_at).select('id').single();
    if (error || !data) throw new Error('Không xóa được profile. Hãy tải lại danh sách và thử lại.');
    this.invalidate(profile.user_id);
    return this.removeObject(profile.screenshot_path);
  }
  async duplicate(profile: MappingProfile, id: string, objectId: string): Promise<SavedProfile> {
    await this.owner(profile.user_id); this.checkPath(profile);
    const path = `${profile.user_id}/${id}/${objectId}.${profile.screenshot_path.split('.').pop()}`;
    const copy = { ...profile, id, name: `${profile.name.slice(0, 69)} (bản sao)`, screenshot_path: path };
    validateProfile(copy); this.checkPath(copy);
    const copied = await this.client.storage.from(MAPPING_BUCKET).copy(profile.screenshot_path, path);
    if (copied.error) throw new Error(`Không nhân bản được ảnh: ${copied.error.message}`);
    try {
      const { created_at: _created, updated_at: _updated, ...payload } = copy;
      const { data, error } = await this.client.from('key_mapping_profiles').insert(payload).select('*').single();
      if (error || !data) throw mappingError(error, 'Không nhân bản được profile');
      this.invalidate(profile.user_id);
      return { profile: data as MappingProfile, warning: null };
    } catch (error) {
      const warning = await this.removeUnreferenced(path, profile.user_id);
      if (warning) throw new Error(`${(error as Error).message} ${warning}`);
      throw error;
    }
  }
}
