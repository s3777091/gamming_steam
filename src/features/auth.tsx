// Phiên đăng nhập dùng CHUNG Supabase với web và jetson-phone: cùng URL, cùng
// anon key, cùng storageKey, nên tài khoản, hồ sơ, cài đặt và phiên stream đều
// là một bộ dữ liệu.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabaseConfigured } from '@/lib/config';
import { UI_DEMO } from '@/lib/demo';
import { bootstrapActiveRegion } from '@/lib/region-routing';
import { createClient } from '@/lib/supabase';

type AuthState =
  | { status: 'loading' }
  | { status: 'config-error' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string | null };

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => UI_DEMO
    ? { status: 'signed-in', userId: 'demo-user', email: 'demo@jetsona.local' }
    : { status: 'loading' });

  useEffect(() => {
    if (UI_DEMO) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    // Chốt host vn/cn TRƯỚC khi tạo Supabase client, để client dùng đúng edge ngay từ đầu.
    void bootstrapActiveRegion().catch(() => {
      // A storage failure must not prevent login using the default region.
    }).then(() => {
      if (!active) return;
      const supabase = createClient();
      if (!supabase || !supabaseConfigured) {
        setState({ status: 'config-error' });
        return;
      }
      // Refresh only while visible: iOS suspends timers when the app backgrounds.
      const syncRefresh = () => {
        if (AppState.currentState === 'active') void supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      };
      syncRefresh();
      const appState = AppState.addEventListener('change', syncRefresh);
      const apply = (user: { id: string; email?: string | null } | null | undefined) => {
        if (!active) return;
        setState(user ? { status: 'signed-in', userId: user.id, email: user.email ?? null } : { status: 'signed-out' });
      };
      void supabase.auth.getSession().then(({ data }) => apply(data.session?.user)).catch(() => apply(null));
      const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
      unsubscribe = () => {
        data.subscription.unsubscribe();
        appState.remove();
        supabase.auth.stopAutoRefresh();
      };
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Người dùng hiện tại; chỉ dùng bên trong cây đã qua cổng đăng nhập. */
export function useSignedInUser(): { userId: string; email: string | null } {
  const state = useAuth();
  return useMemo(() => {
    if (state.status !== 'signed-in') throw new Error('Cần đăng nhập.');
    return { userId: state.userId, email: state.email };
  }, [state]);
}
