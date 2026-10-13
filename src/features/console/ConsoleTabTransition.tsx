import { useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { FocusSuspend } from '@/features/gamepad/focus';
import { STORE_TAB_ORDER, type StoreTab } from '@/features/library/types';
import { useUi } from '@/ui/scale';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';

type TransitionState = {
  currentTab: StoreTab;
  exitingTab: StoreTab | null;
  direction: 'left' | 'right';
  visitedTabs: Set<StoreTab>;
  progress: Animated.Value;
};

/**
 * Hiệu ứng chuyển cảnh giữa các tab Games, Store và PC:
 * - Giữ các tab đã mở (mount) trong cây View để tránh giật lag, mất vị trí cuộn
 *   hoặc tải lại hình ảnh khi chuyển qua lại giữa các tab.
 * - Trượt nhẹ (slide) kết hợp mờ dần (crossfade) giữa tab cũ và tab mới.
 * - Tab không hoạt động được ẩn (display: 'none') để tối ưu tài nguyên và tránh xung đột tiêu điểm.
 */
export function ConsoleTabTransition({
  activeTab,
  renderTab,
}: {
  activeTab: StoreTab;
  renderTab: (tab: StoreTab) => ReactNode;
}) {
  const { s } = useUi();
  const [state, setState] = useState<TransitionState>(() => ({
    currentTab: activeTab,
    exitingTab: null,
    direction: 'right',
    visitedTabs: new Set([activeTab]),
    progress: new Animated.Value(1),
  }));

  // Khi activeTab thay đổi: bắt đầu transition và thêm tab vào danh sách đã truy cập
  if (activeTab !== state.currentTab) {
    const isRight = STORE_TAB_ORDER.indexOf(activeTab) > STORE_TAB_ORDER.indexOf(state.currentTab);
    const nextVisited = new Set(state.visitedTabs);
    nextVisited.add(activeTab);

    setState({
      currentTab: activeTab,
      exitingTab: state.currentTab,
      direction: isRight ? 'right' : 'left',
      visitedTabs: nextVisited,
      // Dùng giá trị mới cho từng lượt chuyển để không mutate animation trong render.
      progress: new Animated.Value(0),
    });
  }

  useEffect(() => {
    if (state.exitingTab === null) return;

    const progress = state.progress;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: TAB_MOTION_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setState((prev) => ({
          ...prev,
          exitingTab: prev.progress === progress ? null : prev.exitingTab,
        }));
      }
    });
    return () => animation.stop();
  }, [state.exitingTab, state.progress]);

  const progress = state.progress;
  const slideOffset = s(12);
  const isMovingRight = state.direction === 'right';

  const enterStart = isMovingRight ? slideOffset : -slideOffset;
  const exitEnd = isMovingRight ? -slideOffset : slideOffset;

  return (
    <View style={styles.container}>
      {STORE_TAB_ORDER.map((tab) => {
        // Chỉ mount các tab đã từng được mở ít nhất 1 lần
        if (!state.visitedTabs.has(tab) && tab !== activeTab) {
          return null;
        }

        const isCurrent = tab === state.currentTab;
        const isExiting = tab === state.exitingTab;
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
        } else if (isCurrent && state.exitingTab !== null) {
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
