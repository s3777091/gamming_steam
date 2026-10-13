import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Moon, Play, Power, RotateCw, X } from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { colors } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type RemoteConnectionMenuProps = {
  open: boolean;
  onClose: () => void;
  online: boolean | null;
  stage?: string;
  reachable: boolean;
  refreshing?: boolean;
  onStream: () => void;
  onReload: () => void;
  onSleep: () => Promise<void> | void;
  onWake?: () => void;
};

/**
 * Tab điều khiển kết nối Remote PC phong cách iOS:
 * - Thả xuống mượt mà (ease in) ngay bên dưới icon kết nối.
 * - Gồm 3 icon nằm ngang (Stream, Làm mới, Đi ngủ/Đánh thức).
 * - Hiệu ứng spring-like fluid bezier của iOS.
 */
export function RemoteConnectionMenu({
  open,
  onClose,
  online,
  stage,
  reachable,
  refreshing = false,
  onStream,
  onReload,
  onSleep,
  onWake,
}: RemoteConnectionMenuProps) {
  const { s, width: screenWidth, insets } = useUi();
  const [anim] = useState(() => new Animated.Value(0));
  const [spinAnim] = useState(() => new Animated.Value(0));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSleeping, setIsSleeping] = useState(false);

  // Hiệu ứng ease in từ trên xuống mượt như iOS
  useEffect(() => {
    if (open) {
      setIsSleeping(false);
      setFeedback(null);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [anim, open]);

  const closeWithAnimation = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 170,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [anim, onClose]);

  useBack(() => {
    closeWithAnimation();
  }, open);

  const isOnline = reachable || online === true;
  const isConnecting = stage === 'network' || stage === 'signal_sent' || (online === null && !reachable);

  const handleStream = () => {
    playUiSound('confirm');
    closeWithAnimation();
    onStream();
  };

  const handleReload = () => {
    playUiSound('navigate');
    setFeedback('Đang làm mới…');
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      setFeedback('Đã làm mới kết nối');
      setTimeout(() => setFeedback(null), 2000);
    });
    onReload();
  };

  const handleSleep = async () => {
    if (isSleeping) return;
    playUiSound('confirm');
    setIsSleeping(true);
    setFeedback('Đang ru PC ngủ & thoát…');
    try {
      await onSleep();
    } catch {
      setIsSleeping(false);
      setFeedback('Không thể ru ngủ');
    }
  };

  const handleWake = () => {
    playUiSound('confirm');
    setFeedback('Đang gửi tín hiệu bật máy…');
    onWake?.();
    setTimeout(() => setFeedback(null), 2500);
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!open) return null;

  const cardWidth = Math.min(s(318), screenWidth - s(32));

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]}>
      {/* Lớp nền mờ trong suốt để chạm ngoài đóng tab */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.38)', opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeWithAnimation}
          accessibilityLabel="Đóng menu kết nối"
        />
      </Animated.View>

      {/* Tab pill nổi ngang kiểu iOS ease in xuống */}
      <Animated.View
        style={[
          styles.iosPill,
          {
            width: cardWidth,
            top: s(48) + insets.top + s(4),
            right: Math.max(s(16), s(22) + insets.right + s(96)),
            borderRadius: s(22),
            paddingHorizontal: s(12),
            paddingTop: s(10),
            paddingBottom: s(11),
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-26, 0],
                }),
              },
              {
                scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.88, 1],
                }),
              },
            ],
          },
        ]}
      >
        {/* Dòng trạng thái nhỏ trên cùng */}
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <View
              style={[
                styles.dot,
                {
                  width: s(6),
                  height: s(6),
                  borderRadius: s(3),
                  backgroundColor: isOnline ? colors.success : isConnecting ? colors.warning : colors.text4,
                },
              ]}
            />
            <T size={10.2} weight="semibold" color={colors.text2}>
              {isOnline ? 'PC đã kết nối' : isConnecting ? 'Đang kết nối PC…' : 'PC đang ngủ / tắt'}
            </T>
          </View>

          {feedback ? (
            <T size={9.8} weight="semibold" color={colors.accentSoft} numberOfLines={1}>
              {feedback}
            </T>
          ) : (
            <Press
              onPress={closeWithAnimation}
              sound="back"
              accessibilityLabel="Đóng tab"
              style={[styles.closeIconBtn, { width: s(20), height: s(20), borderRadius: s(10) }]}
            >
              <X size={s(11)} color={colors.text3} />
            </Press>
          )}
        </View>

        {/* 3 ICON NẰM NGANG (Horizontal Tab) */}
        <View style={[styles.horizontalRow, { gap: s(8), marginTop: s(8) }]}>
          {/* 1. Streaming */}
          <Press
            onPress={handleStream}
            sound="confirm"
            pressScale={0.93}
            style={[styles.tabButton, { borderRadius: s(16), paddingVertical: s(10) }]}
            accessibilityLabel="Phát trực tiếp streaming"
          >
            <View style={[styles.iconBubble, { width: s(40), height: s(40), borderRadius: s(20), backgroundColor: 'rgba(102,168,255,0.2)' }]}>
              <Play size={s(17)} color={colors.accent} fill={colors.accent} />
            </View>
            <T size={11} weight="semibold" color={colors.white} style={{ marginTop: s(6) }}>
              Stream
            </T>
            <T size={8.8} color={colors.text3} style={{ marginTop: s(1) }}>
              Phát PC
            </T>
          </Press>

          {/* 2. Reload kết nối */}
          <Press
            onPress={handleReload}
            sound="navigate"
            pressScale={0.93}
            style={[styles.tabButton, { borderRadius: s(16), paddingVertical: s(10) }]}
            accessibilityLabel="Làm mới kết nối remote"
          >
            <View style={[styles.iconBubble, { width: s(40), height: s(40), borderRadius: s(20), backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.text2} />
              ) : (
                <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                  <RotateCw size={s(17)} color={colors.text} strokeWidth={2.2} />
                </Animated.View>
              )}
            </View>
            <T size={11} weight="semibold" color={colors.white} style={{ marginTop: s(6) }}>
              Làm mới
            </T>
            <T size={8.8} color={colors.text3} style={{ marginTop: s(1) }}>
              Nối lại PC
            </T>
          </Press>

          {/* 3. Đi ngủ (Sleep PC) / Đánh thức */}
          {isOnline ? (
            <Press
              onPress={() => void handleSleep()}
              sound="confirm"
              pressScale={0.93}
              style={[styles.tabButton, { borderRadius: s(16), paddingVertical: s(10) }]}
              accessibilityLabel="Cho PC đi ngủ"
            >
              <View style={[styles.iconBubble, { width: s(40), height: s(40), borderRadius: s(20), backgroundColor: 'rgba(192,132,252,0.2)' }]}>
                {isSleeping ? (
                  <ActivityIndicator size="small" color="#c084fc" />
                ) : (
                  <Moon size={s(17)} color="#c084fc" strokeWidth={2.2} />
                )}
              </View>
              <T size={11} weight="semibold" color={colors.white} style={{ marginTop: s(6) }}>
                Đi ngủ
              </T>
              <T size={8.8} color={colors.text3} style={{ marginTop: s(1) }}>
                Ru & thoát
              </T>
            </Press>
          ) : (
            <Press
              onPress={handleWake}
              sound="confirm"
              pressScale={0.93}
              style={[styles.tabButton, { borderRadius: s(16), paddingVertical: s(10) }]}
              accessibilityLabel="Đánh thức PC"
            >
              <View style={[styles.iconBubble, { width: s(40), height: s(40), borderRadius: s(20), backgroundColor: 'rgba(74,222,128,0.2)' }]}>
                <Power size={s(17)} color={colors.success} strokeWidth={2.2} />
              </View>
              <T size={11} weight="semibold" color={colors.white} style={{ marginTop: s(6) }}>
                Bật máy
              </T>
              <T size={8.8} color={colors.text3} style={{ marginTop: s(1) }}>
                Wake-on-LAN
              </T>
            </Press>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iosPill: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(14, 22, 34, 0.94)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dot: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  closeIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  horizontalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
