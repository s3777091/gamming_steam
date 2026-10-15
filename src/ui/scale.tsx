import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DESIGN } from '@/theme';

type Ui = {
  width: number;
  height: number;
  /** Phóng một số dp của khung thiết kế 932x430 theo màn hình hiện tại. */
  s: (value: number) => number;
  scale: number;
  insets: { top: number; right: number; bottom: number; left: number };
  /** Màn lớn (tablet): layout nới rộng thay vì chỉ phóng to. */
  tablet: boolean;
};

export const UiContext = createContext<Ui | null>(null);

/**
 * App được vẽ ở khung 932x430 (iPhone 14 Pro Max nằm ngang). Galaxy Tab S9
 * (1280x800 dp) cùng tỉ lệ gần đúng, nên mọi kích thước nhân cùng một hệ số;
 * không dùng tỉ lệ riêng cho từng cạnh để thẻ game không bị méo.
 */
export function UiProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const value = useMemo<Ui>(() => {
    const raw = Math.min(width / DESIGN.width, height / DESIGN.height);
    const scale = Math.min(1.75, Math.max(0.8, raw));
    return {
      width,
      height,
      scale,
      s: (n: number) => Math.round(n * scale * 100) / 100,
      insets: safe,
      tablet: Math.min(width, height) >= 600,
    };
  }, [height, safe, width]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): Ui {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi cần UiProvider.');
  return value;
}
