import { useMemo } from 'react';

import { useTheme } from '@/theme';
import type { GlassTokens } from '@/theme/types';

/** Nhịp mở/đóng chung của menu nổi. */
export const MENU_MOTION = { openMs: 200, closeMs: 150 } as const;

/** Kính dùng chung cho menu header, Guide ở Home và Guide khi stream — lấy màu theo theme đang chọn. */
export function menuGlassFrom(glass: GlassTokens) {
  return {
    panelTint: glass.panelOverlay,
    panelFallback: glass.modal,
    control: glass.control,
    controlActive: glass.controlActive,
    inset: glass.surfaceThin,
    border: glass.controlBorder,
    borderActive: glass.controlBorderActive,
    scrim: glass.scrim,
    ink: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.72)',
  } as const;
}

export function useMenuGlass() {
  const { glass } = useTheme();
  return useMemo(() => menuGlassFrom(glass), [glass]);
}
