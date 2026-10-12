import { useCallback, useEffect, useState } from 'react';

import { normalizeProfileAvatarUrl } from '@/lib/profile-avatar';
import { createClient } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string | null;
  email: string | null;
};

export function useUserProfile(userId: string, email: string | null) {
  const fallbackName = email?.split('@')[0] || 'Người dùng';
  const [profile, setProfile] = useState<UserProfile>({
    id: userId,
    username: email?.split('@')[0] || 'user',
    displayName: fallbackName,
    avatarUrl: null,
    role: null,
    email,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url,role')
      .eq('id', userId)
      .maybeSingle();
    if (queryError) {
      setError(queryError.message);
    } else if (data) {
      setError(null);
      setProfile({
        id: userId,
        username: data.username || email?.split('@')[0] || 'user',
        displayName: data.display_name || data.username || fallbackName,
        // Giữ dạng tương đối: giá trị này còn được gửi qua signalling watch party.
        // Nơi render tự ghép base URL (resolveProfileAvatarUri).
        avatarUrl: normalizeProfileAvatarUrl(data.avatar_url),
        role: data.role || null,
        email,
      });
    }
    setLoading(false);
  }, [email, fallbackName, userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { profile, loading, error, refresh };
}
