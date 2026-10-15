import { useEffect } from 'react';

import { useSceneActive } from '@/features/gamepad/focus';
import { BackdropPreloader } from '@/lib/backdrop-preloader';
import { prefetchImage } from '@/ui/Img';
import { useMotion } from '@/ui/motion';

const preloader = new BackdropPreloader(prefetchImage);

export function useBackdropPreload(urls: readonly string[]) {
  const sceneActive = useSceneActive();
  const { active } = useMotion();
  useEffect(() => {
    if (!sceneActive || !active) return;
    return preloader.schedule(urls);
  }, [active, sceneActive, urls]);
}
