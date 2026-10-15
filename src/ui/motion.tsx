import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

const MotionContext = createContext({ active: true, reduceMotion: false });

/** One pair of native listeners for the whole UI, including cached tabs. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let disposed = false;
    let receivedPreference = false;
    const app = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      receivedPreference = true;
      setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!disposed && !receivedPreference) setReduceMotion(value);
    }).catch(() => {});
    return () => {
      disposed = true;
      app.remove();
      motion.remove();
    };
  }, []);

  const value = useMemo(() => ({ active, reduceMotion }), [active, reduceMotion]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion() {
  return useContext(MotionContext);
}
