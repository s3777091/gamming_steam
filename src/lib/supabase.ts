// Supabase client cho React Native. Khác với bản web (createBrowserClient +
// cookie), RN dùng createClient với AsyncStorage làm nơi lưu session và cần
// react-native-url-polyfill để supabase-js có URL/whatwg đầy đủ.
//
// Một client duy nhất = một Realtime WebSocket. Các tính năng tách channel
// riêng (presence, occupancy, access) như bản web — xem realtimeChannels.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { SUPABASE_ANON_KEY, getSupabaseUrl, supabaseConfigured } from '@/lib/config';


let client: SupabaseClient | null = null;

/**
 * Trả về Supabase client. Khi chưa cấu hình (thiếu URL/key) trả về null — các
 * hook gọi hàm này phải xử lý null (chế độ khách).
 */
export function createClientRN(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  client ??= createSupabaseClient(getSupabaseUrl(), SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      // Cố định key lưu session để phiên sống sót khi đổi host giữa vn/cn edge
      // (supabase-js vốn sinh key từ URL, đổi host -> mất session). Bản web
      // pin cookie name sb-ai-auth-token cho cùng lý do.
      storageKey: 'sb-ai-auth-token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      // RN có WebSocket native; supabase-js tự dùng được.
      params: { eventsPerSecond: 10 },
    },
  });
  return client;
}

/** Alias ngắn cho các hook port từ web (bản web gọi createClient()). */
export function createClient(): SupabaseClient | null {
  return createClientRN();
}
