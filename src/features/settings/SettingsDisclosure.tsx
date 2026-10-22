import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useMotion } from '@/ui/motion';

/** Measure intrinsic content so opening and closing both animate without a fixed height. */
export function SettingsDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  const { reduceMotion } = useMotion();
  const [mounted, setMounted] = useState(open);
  const [height, setHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));

  if (open && !mounted) setMounted(true);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: open ? height : 0, duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: false, isInteraction: false,
    });
    animation.start(({ finished }) => { if (finished && !open) setMounted(false); });
    return () => animation.stop();
  }, [height, open, progress, reduceMotion]);

  if (!mounted) return null;
  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={{ height: progress, overflow: 'hidden' }}>
      <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        {children}
      </View>
    </Animated.View>
  );
}
