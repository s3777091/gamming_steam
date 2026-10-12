import { backendUrl } from '@/lib/config';
import { createClient } from '@/lib/supabase';

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const sessionResult = supabase ? await supabase.auth.getSession() : null;
  const token = sessionResult?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch tới jetsona-ui bằng chính phiên Supabase của app. Server xác minh JWT;
 * APK không chứa mật khẩu máy chủ hay input token dùng chung.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getApiAuthHeaders();
  const headers = new Headers(init.headers);
  Object.entries(authHeaders).forEach(([name, value]) => headers.set(name, value));
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  return fetch(backendUrl(path), { ...init, headers });
}

export async function apiJson<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok || !data) {
    const message = data && typeof data === 'object' && 'error' in data
      ? String((data as { error?: unknown }).error || `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}
