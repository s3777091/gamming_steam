import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useMotion } from '@/ui/motion';

import { DEFAULT_THEME_ID, getTheme, isThemeId, THEMES } from './registry';
import { ThemeTransition, type ThemeTransitionOrigin } from './ThemeTransition';
import type { Theme, ThemeId } from './types';

const THEME_KEY = 'jetsona:ui_theme';
const DECOR_KEY = 'jetsona:ui_theme_decor';

export type ThemeChangeOptions = {
  /** Điểm giọt màu rơi xuống (toạ độ cửa sổ), thường là chỗ người dùng vừa bấm. */
  origin?: ThemeTransitionOrigin;
  /** Gọi khi giọt màu bắt đầu rơi, ví dụ để phát tiếng huýt. */
  onStart?: () => void;
  /** Gọi đúng lúc giọt màu chạm xuống, ví dụ để phát tiếng bloop. */
  onImpact?: () => void;
};

type ThemeContextValue = {
  theme: Theme;
  setThemeId: (id: ThemeId, options?: ThemeChangeOptions) => void;
};

type Transition = { to: ThemeId } & ThemeChangeOptions;

const ThemeContext = createContext<ThemeContextValue>({
  theme: getTheme(DEFAULT_THEME_ID),
  setThemeId: () => {},
});

type DecorContextValue = { enabled: boolean; setEnabled: (enabled: boolean) => void };

// Tách riêng khỏi ThemeContext: bật/tắt trang trí không làm cả app vẽ lại.
const DecorContext = createContext<DecorContextValue>({ enabled: true, setEnabled: () => {} });

type State = { themeId: ThemeId | null; transition: Transition | null; decor: boolean };
type Action =
  | { type: 'loaded'; id: ThemeId; decor: boolean }
  | { type: 'decor'; enabled: boolean }
  | { type: 'request'; id: ThemeId; options?: ThemeChangeOptions; animate: boolean }
  | { type: 'commit'; id: ThemeId }
  | { type: 'finish' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return state.themeId ? state : { ...state, themeId: action.id, decor: action.decor };
    case 'decor':
      return { ...state, decor: action.enabled };
    case 'request':
      // Bỏ qua khi đang chạy hiệu ứng: giọt màu sau không được cắt ngang giọt trước.
      if (state.transition || action.id === state.themeId) return state;
      if (!action.animate) return { ...state, themeId: action.id };
      return { ...state, transition: { to: action.id, ...action.options } };
    case 'commit':
      return { ...state, themeId: action.id };
    case 'finish':
      return { ...state, transition: null };
  }
}

/** Đọc theme đã chọn trên máy rồi mới vẽ app, để không nháy theme mặc định trước. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { reduceMotion } = useMotion();
  const [{ themeId, transition, decor }, dispatch] = useReducer(reducer, { themeId: null, transition: null, decor: true });

  useEffect(() => {
    let alive = true;
    Promise.all([AsyncStorage.getItem(THEME_KEY).catch(() => null), AsyncStorage.getItem(DECOR_KEY).catch(() => null)])
      .then(([stored, decorStored]) => {
        if (alive) dispatch({ type: 'loaded', id: isThemeId(stored) ? stored : DEFAULT_THEME_ID, decor: decorStored !== 'off' });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (themeId) AsyncStorage.setItem(THEME_KEY, themeId).catch(() => {});
  }, [themeId]);

  const setThemeId = useCallback(
    (id: ThemeId, options?: ThemeChangeOptions) => dispatch({ type: 'request', id, options, animate: !reduceMotion }),
    [reduceMotion],
  );
  const finish = useCallback(() => dispatch({ type: 'finish' }), []);

  const setDecorEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'decor', enabled });
    AsyncStorage.setItem(DECOR_KEY, enabled ? 'on' : 'off').catch(() => {});
  }, []);
  const decorValue = useMemo(() => ({ enabled: decor, setEnabled: setDecorEnabled }), [decor, setDecorEnabled]);

  const value = useMemo(
    () => (themeId ? { theme: getTheme(themeId), setThemeId } : null),
    [themeId, setThemeId],
  );

  // Splash vẫn đang che màn hình trong lúc đọc AsyncStorage.
  if (!value) return null;
  return (
    <ThemeContext.Provider value={value}>
      <DecorContext.Provider value={decorValue}>{children}</DecorContext.Provider>
      {transition ? (
        <ThemeTransition
          key={transition.to}
          theme={getTheme(transition.to)}
          origin={transition.origin ?? null}
          committed={themeId === transition.to}
          onStart={transition.onStart}
          onImpact={transition.onImpact}
          // Cả app vẽ lại theo theme mới: chạy dạng transition để React chia nhỏ việc vẽ,
          // tay cầm và chạm vẫn phản hồi thay vì đứng hình trong lúc màn đang bị phủ.
          onCovered={() => startTransition(() => dispatch({ type: 'commit', id: transition.to }))}
          onDone={finish}
        />
      ) : null}
    </ThemeContext.Provider>
  );
}

/** Token của theme đang dùng. Component gọi hook này sẽ vẽ lại khi người dùng đổi theme. */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** Danh sách theme và hàm đổi theme (kèm hiệu ứng giọt màu), cho màn Cài đặt → Giao diện. */
export function useThemeControl() {
  const { theme, setThemeId } = useContext(ThemeContext);
  const decor = useContext(DecorContext);
  return { themeId: theme.id, setThemeId, themes: THEMES, decorEnabled: decor.enabled, setDecorEnabled: decor.setEnabled };
}

/** Người dùng có bật trang trí theo theme không (Cài đặt → Giao diện). */
export function useDecorEnabled(): boolean {
  return useContext(DecorContext).enabled;
}

/**
 * StyleSheet phụ thuộc theme. Viết ở cấp module như StyleSheet.create, gọi hook trong component:
 *
 *   const useStyles = makeStyles(({ colors }) => ({ card: { backgroundColor: colors.card } }));
 *   function Card() { const styles = useStyles(); ... }
 *
 * Mỗi theme chỉ dựng StyleSheet một lần.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: Theme) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const cache = new Map<ThemeId, T>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme.id);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme.id, styles);
    }
    return styles;
  };
}
