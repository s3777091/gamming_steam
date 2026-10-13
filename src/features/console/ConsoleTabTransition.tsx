import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { STORE_TAB_ORDER, type StoreTab } from '@/features/library/types';
import { useUi } from '@/ui/scale';

/**
 * Hiệu ứng chuyển cảnh giữa các tab Games, Store và PC:
 * - Trượt nhẹ theo hướng điều hướng (sang tab bên phải: từ phải sang; sang tab bên trái: từ trái sang).
 * - Mờ dần trang cũ (crossfade 1 -> 0) và hiện dần trang mới (0 -> 1).
 * - Tự giải phóng trang cũ sau khi hoàn tất animation để giải phóng DOM và tránh tranh chấp tiêu điểm.
 */
export function ConsoleTabTransition({
  activeTab,
  renderTab,
}: {
  activeTab: StoreTab;
  renderTab: (tab: StoreTab) => ReactNode;
}) {
  const { s } = useUi();
  const [prevActiveTab, setPrevActiveTab] = useState<StoreTab>(activeTab);
  const [exitingTab, setExitingTab] = useState<StoreTab | null>(null);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [progress] = useState(() => new Animated.Value(1));

  // Cập nhật trạng thái chuyển tab ngay trong quá trình render (chuẩn React 19)
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    setExitingTab(prevActiveTab);
    setDirection(STORE_TAB_ORDER.indexOf(activeTab) > STORE_TAB_ORDER.indexOf(prevActiveTab) ? 'right' : 'left');
  }

  useEffect(() => {
    if (exitingTab === null) return;

    progress.stopAnimation();
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setExitingTab(null);
      }
    });
  }, [exitingTab, progress]);

  const slideOffset = s(34);
  const isMovingRight = direction === 'right';

  const enterStart = isMovingRight ? slideOffset : -slideOffset;
  const exitEnd = isMovingRight ? -slideOffset : slideOffset;

  return (
    <View style={styles.container}>
      {exitingTab ? (
        <Animated.View
          key={`exit-${exitingTab}`}
          pointerEvents="none"
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFill,
            {
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
            },
          ]}
        >
          {renderTab(exitingTab)}
        </Animated.View>
      ) : null}

      <Animated.View
        key={`enter-${activeTab}`}
        style={[
          styles.page,
          exitingTab ? {
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
          } : undefined,
        ]}
      >
        {renderTab(activeTab)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  page: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
