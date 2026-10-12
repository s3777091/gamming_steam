// client_device_id ổn định cho thiết bị này (P0). Khác với clientId cũ (sinh lại mỗi
// phiên), id này tồn tại qua các lần mở app để:
//   - đo mạng được gắn với ĐÚNG thiết bị (network_test_results.client_device_id),
//   - server gom các phiên của cùng thiết bị khi nhận diện "phiên kế cận".
//
// AI SINH RA ID: SERVER, KHÔNG PHẢI APP.
// -------------------------------------
// `register_client_device(p_device_key, p_name, p_platform, p_user_agent)` upsert
// vào public.client_devices rồi RETURNS UUID của hàng đó. Cái UUID ấy mới là
// client_device_id mà stream_sessions.client_device_id trỏ tới bằng khoá ngoại.
//
// App chỉ giữ `device_key` — một chuỗi ổn định cục bộ dùng làm khoá tra cứu, KHÔNG
// phải id. Tự bịa UUID rồi đem đi claim sẽ làm insert stream_sessions gãy khoá
// ngoại ("violates foreign key constraint stream_sessions_client_device_id_fkey")
// và toàn bộ PC/VM/Steam đều không mở được phiên.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createStreamSetupToken } from './setup-token';

const DEVICE_KEY_STORAGE = 'jetsona.client_device_key';
/** Id server trả về lần trước — chỉ để tránh gọi RPC lại trong cùng phiên chạy. */
let cachedDeviceId: string | null = null;

async function ensureDeviceKey(): Promise<string> {
  let key = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    // createStreamSetupToken là UUID v4 chuẩn — dùng làm khoá tra cứu ổn định.
    key = createStreamSetupToken();
    await AsyncStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
}

function deviceName(): string {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return `Mobile · ${os}`;
}

/**
 * Đăng ký thiết bị và trả về client_device_id DO SERVER SINH.
 *
 * Ném lỗi khi không đăng ký được. Cố tình không nuốt lỗi: nuốt xong thì phần
 * claim phía sau sẽ đi tiếp với một id không tồn tại và chết ở tầng khoá ngoại
 * với thông báo khó hiểu, thay vì hỏng ngay tại chỗ hỏng thật.
 */
export async function ensureClientDeviceId(supabase: SupabaseClient | null): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  if (!supabase) throw new Error('Chưa đăng nhập nên không đăng ký được thiết bị.');

  const deviceKey = await ensureDeviceKey();
  const { data, error } = await supabase.rpc('register_client_device', {
    p_device_key: deviceKey,
    p_name: deviceName(),
    p_platform: `${Platform.OS} ${String(Platform.Version)}`,
    p_user_agent: `Jetsona-Native/${Platform.OS}`,
  });
  if (error) throw new Error(error.message || 'Không đăng ký được thiết bị.');
  if (typeof data !== 'string' || !data) {
    throw new Error('Máy chủ không trả về mã thiết bị.');
  }

  cachedDeviceId = data;
  return data;
}

/** Xoá cache trong bộ nhớ (đăng xuất / đổi tài khoản: id thuộc về user khác). */
export function resetClientDeviceCache(): void {
  cachedDeviceId = null;
}
