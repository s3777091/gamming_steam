import { memo, useLayoutEffect, useState, type ReactNode } from 'react';
import { Animated, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { FocusSuspend } from '@/features/gamepad/focus';
import { STORE_TAB_ORDER, type StoreTab } from '@/features/library/types';
import { useUi } from '@/ui/scale';
import { useMotion } from '@/ui/motion';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';

const TabContent = memo(function TabContent({ active, tab, renderTab }: {
  active: boolean;
  tab: StoreTab;
  renderTab: (tab: StoreTab) => ReactNode;
}) {
  return <FocusSuspend suspended={!active}>{renderTab(tab)}</FocusSuspend>;
}, (previous, next) => previous.active === next.active && previous.tab === next.tab
  && (!next.active || previous.renderTab === next.renderTab));

/**
 * Hiệu ứng chuyển cảnh giữa các tab Games, Store và PC:
 * - Giữ các tab đã mở (mount) trong cây View để tránh giật lag, mất vị trí cuộn
 *   hoặc tải lại hình ảnh khi chuyển qua lại giữa các tab.
 * - Tab mới lướt nhẹ vào và mượt mà phủ lên tab cũ mà không bị khựng, không chớp đen.
 * - Tab không hoạt động ĐƯỢC ẨN BẰNG display: 'none' (View.GONE trên Android) để
 *   đảm bảo không bị đè hình ảnh, không xung đột tiêu điểm và không tiêu tốn GPU/RenderNode.
 * - Tab không hoạt động được treo tiêu điểm (FocusSuspend).
 */
export function ConsoleTabTransition({
  activeTab,
  renderTab,
}: {
  activeTab: StoreTab;
  renderTab: (tab: StoreTab) => ReactNode;
}) {
  const { s } = useUi();
  const { active, reduceMotion } = useMotion();
  const [visitedTabs, setVisitedTabs] = useState<Set<StoreTab>>(() => new Set([activeTab]));
  const [activeState, setActiveState] = useState({
    currentTab: activeTab,
    outgoingTab: null as StoreTab | null,
    direction: 'right' as 'left' | 'right',
  });
  const [progress] = useState(() => new Animated.Value(1));

  // Đồng bộ trạng thái khi activeTab thay đổi
  if (activeTab !== activeState.currentTab) {
    const isRight = STORE_TAB_ORDER.indexOf(activeTab) > STORE_TAB_ORDER.indexOf(activeState.currentTab);
    setActiveState({
      currentTab: activeTab,
      outgoingTab: activeState.currentTab,
      direction: isRight ? 'right' : 'left',
    });
    if (!visitedTabs.has(activeTab)) {
      setVisitedTabs((prev) => new Set(prev).add(activeTab));
    }
  }

  const { outgoingTab, direction, currentTab } = activeState;

  useLayoutEffect(() => {
    if (!outgoingTab) return;

    // Reset after commit, before paint. Interrupted animations must never clear
    // the outgoing tab or overwrite progress belonging to the next transition.
    let cancelled = false;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: active && !reduceMotion ? TAB_MOTION_MS : 0,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });

    animation.start(({ finished }) => {
      if (!finished || cancelled) return;
      setActiveState((prev) => prev.currentTab === currentTab && prev.outgoingTab === outgoingTab
        ? { ...prev, outgoingTab: null } : prev);
    });

    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [active, currentTab, outgoingTab, progress, reduceMotion]);

  const slideOffset = s(16);
  const isMovingRight = direction === 'right';
  const enterStart = isMovingRight ? slideOffset : -slideOffset;
  const exitEnd = isMovingRight ? -slideOffset * 0.4 : slideOffset * 0.4;

  return (
    <View style={styles.container}>
      {STORE_TAB_ORDER.map((tab) => {
        // Chỉ mount các tab đã từng được mở ít nhất 1 lần
        if (!visitedTabs.has(tab) && tab !== activeTab) {
          return null;
        }

        const isCurrent = tab === currentTab;
        const isOutgoing = tab === outgoingTab;
        const isVisible = isCurrent || isOutgoing;

        let animStyle: StyleProp<Animated.WithAnimatedValue<ViewStyle>> = styles.hidden;
        let pointerEvents: 'auto' | 'none' = 'none';

        if (isCurrent) {
          pointerEvents = 'auto';
          if (outgoingTab) {
            animStyle = {
              zIndex: 2,
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
          } else {
            animStyle = {
              zIndex: 2,
              opacity: 1,
            };
          }
        } else if (isOutgoing) {
          pointerEvents = 'none';
          animStyle = {
            zIndex: 1,
            opacity: progress.interpolate({
              inputRange: [0, 0.65, 1],
              outputRange: [1, 0.35, 0],
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
        }

        return (
          <Animated.View
            key={tab}
            pointerEvents={pointerEvents}
            accessibilityElementsHidden={!isCurrent}
            importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
            style={[
              StyleSheet.absoluteFill,
              { display: isVisible ? 'flex' : 'none' },
              animStyle,
            ]}
          >
            <TabContent active={isCurrent} tab={tab} renderTab={renderTab} />
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
  hidden: {
    opacity: 0,
    zIndex: 0,
    display: 'none',
    position: 'absolute',
    left: -9999,
  },
});
