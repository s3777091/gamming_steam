import { setStatusBarHidden } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { setImmersive } from 'jetsona-input';

import { useGuide } from './hooks';

const SYSTEM_BARS_AUTO_HIDE_MS = 4000;

function setSystemBarsVisible(visible: boolean): void {
  setStatusBarHidden(!visible, 'none');
  setImmersive(!visible);
}

export function useTemporarySystemBars(enabled: boolean): void {
  const visible = useRef(false);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    autoHideTimer.current = null;
    visible.current = false;
    setSystemBarsVisible(false);
  }, []);

  const toggle = useCallback(() => {
    if (visible.current) {
      hide();
      return;
    }

    visible.current = true;
    setSystemBarsVisible(true);
    autoHideTimer.current = setTimeout(hide, SYSTEM_BARS_AUTO_HIDE_MS);
  }, [hide]);

  useGuide(toggle, enabled);

  // Keep the stream fully immersive; it handles the Start + Select combo itself.
  useEffect(() => {
    if (!enabled) hide();
    return hide;
  }, [enabled, hide]);
}
