import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { FocusSuspend } from '@/features/gamepad/focus';
import { STORE_TAB_ORDER, type StoreTab } from '@/features/library/types';
import { useUi } from '@/ui/scale';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';

/**
 * Hiệu ứng chuyển cảnh giữa các tab Games, Store và PC:
 * - Giữ các tab đã mở (mount) trong cây View để tránh giật lag, mất vị trí cuộn
 *   hoặc tải lại hình ảnh khi chuyển qua lại giữa các tab.
 * - Trượt nhẹ (slide) kết hợp mờ dần (crossfade) đồng bộ giữa tab cũ và tab mới.
 * - Tab không hoạt động được ẩn mờ và treo tiêu điểm (FocusSuspend).
 */
export function ConsoleTabTransition({
  activeTab,
  renderTab,
}: {
  activeTab: StoreTab;
  renderTab: (tab: StoreTab) => ReactNode;
}) {
  const { s } = useUi();
  const [visitedTabs, setVisitedTabs] = useState<Set<StoreTab>>(() => new Set([activeTab]));
  const currentTabRef = useRef(activeTab);
  const [displayTab, setDisplayTab] = useState(activeTab);
  const [exitingTab, setExitingTab] = useState<StoreTab | null>(null);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [progress] = useState(() => new Animated.Value(1));
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (activeTab === currentTabRef.current) return;

    const prev = currentTabRef.current;
    currentTabRef.current = activeTab;

    setVisitedTabs((current) => {
      if (current.has(activeTab)) return current;
      const next = new Set(current);
      next.add(activeTab);
      return next;
    });

    const isRight = STORE_TAB_ORDER.indexOf(activeTab) > STORE_TAB_ORDER.indexOf(prev);
    setDirection(isRight ? 'right' : 'left');
    setExitingTab(prev);
    setDisplayTab(activeTab);

    animRef.current?.stop();
    progress.setValue(0);

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: TAB_MOTION_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
    });
    animRef.current = animation;

    animation.start(({ finished }) => {
      if (finished) {
        setExitingTab(null);
      }
    });

    return () => {
      animation.stop();
    };
  }, [activeTab, progress]);

  const slideOffset = s(16);
  const isMovingRight = direction === 'right';
  const enterStart = isMovingRight ? slideOffset : -slideOffset;
  const exitEnd = isMovingRight ? -slideOffset : slideOffset;

  return (
    <View style={styles.container}>
      {STORE_TAB_ORDER.map((tab) => {
        // Chỉ mount các tab đã từng được mở ít nhất 1 lần
        if (!visitedTabs.has(tab) && tab !== activeTab) {
          return null;
        }

        const isCurrent = tab === displayTab;
        const isExiting = tab === exitingTab;
        const isVisible = isCurrent || isExiting;

        let animStyle = undefined;
        if (isExiting) {
          animStyle = {
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, exitEnd],
                }),
              },
            ],
          };
        } else if (isCurrent && exitingTab !== null) {
          animStyle = {
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [enterStart, 0],
                }),
              },
            ],
          };
        } else if (isCurrent) {
          animStyle = {
            opacity: 1,
            transform: [{ translateX: 0 }],
          };
        }

        return (
          <Animated.View
            key={tab}
            pointerEvents={isCurrent ? 'auto' : 'none'}
            accessibilityElementsHidden={!isCurrent}
            importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
            style={[
              StyleSheet.absoluteFill,
              !isVisible ? styles.hidden : animStyle,
            ]}
          >
            <FocusSuspend suspended={!isCurrent}>{renderTab(tab)}</FocusSuspend>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  // opacity 0 thay vì display: 'none': tab ẩn vẫn gắn trong cây nên hiện lại không phải layout/vẽ lại từ đầu.
  hidden: {
    opacity: 0,
    zIndex: -1,
  },
});
