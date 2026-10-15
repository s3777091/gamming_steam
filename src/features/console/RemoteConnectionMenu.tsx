import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Moon, Play, Power, RotateCw } from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { colors, glass } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type RemoteConnectionMenuProps = {
  open: boolean;
  anchorRef?: RefObject<View | null>;
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
 * Menu điều khiển kết nối Remote PC:
 * - Hiệu ứng slide out trượt xuống dưới từ thanh header.
 * - Các nút chức năng thiết kế đồng bộ glassmorphism tinh tế.
 * - Chỉ giữ icon nhỏ gọn, lược bỏ các text thừa tránh gây rối mắt.
 */
export function RemoteConnectionMenu({
  open,
  anchorRef,
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
  const closingRef = useRef(false);
  const [spinAnim] = useState(() => new Animated.Value(0));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSleeping, setIsSleeping] = useState(false);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Đo tọa độ nút bấm kết nối để thả menu chuẩn xác ngay bên dưới
  useEffect(() => {
    if (open && anchorRef?.current) {
      anchorRef.current.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setAnchorPos({ x, y, width, height });
        }
      });
    }
  }, [open, anchorRef]);

  // Hiệu ứng slide out trượt mượt mà từ trên xuống
  useEffect(() => {
    if (open) {
      closingRef.current = false;
      anim.setValue(0);
      const animation = Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }
  }, [anim, open]);

  const closeWithAnimation = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    anim.stopAnimation();
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false;
        return;
      }
      setIsSleeping(false);
      setFeedback(null);
      onClose();
      after?.();
    });
  }, [anim, onClose]);

  useBack(() => {
    closeWithAnimation();
  }, open);

  const isOnline = reachable || online === true;
  const isConnecting = stage === 'network' || stage === 'signal_sent' || (online === null && !reachable);

  const handleStream = () => {
    playUiSound('confirm');
    closeWithAnimation(onStream);
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
      setFeedback('Đã làm mới');
      setTimeout(() => setFeedback(null), 1800);
    });
    onReload();
  };

  const handleSleep = async () => {
    if (isSleeping) return;
    playUiSound('confirm');
    setIsSleeping(true);
    setFeedback('Đang ru ngủ…');
    try {
      await onSleep();
    } catch {
      setIsSleeping(false);
      setFeedback('Lỗi ru ngủ');
      setTimeout(() => setFeedback(null), 1800);
    }
  };

  const handleWake = () => {
    playUiSound('confirm');
    setFeedback('Đang gửi tín hiệu…');
    onWake?.();
    setTimeout(() => setFeedback(null), 2500);
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!open) return null;

  const cardWidth = Math.min(s(184), screenWidth - s(24));
  const fallbackTop = s(48) + insets.top + s(4);
  const fallbackRight = Math.max(s(16), s(22) + insets.right + s(96));

  const topPos = anchorPos ? anchorPos.y + anchorPos.height + s(6) : fallbackTop;
  const leftPos = anchorPos
    ? Math.max(
        s(12) + insets.left,
        Math.min(
          anchorPos.x + anchorPos.width / 2 - cardWidth / 2,
          screenWidth - cardWidth - s(12) - insets.right,
        ),
      )
    : undefined;

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]}>
        {/* Lớp nền trong suốt bắt chạm ngoài để đóng */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.32)', opacity: anim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => closeWithAnimation()}
            focusable={false}
            accessibilityLabel="Đóng menu kết nối"
          />
        </Animated.View>

        {/* Khung nổi glass trượt xuống mượt mà từ trên */}
        <Animated.View
          style={[
            styles.glassCard,
            {
              width: cardWidth,
              top: topPos,
              left: leftPos,
              right: leftPos !== undefined ? undefined : fallbackRight,
              borderRadius: s(18),
              paddingHorizontal: s(10),
              paddingTop: s(9),
              paddingBottom: s(10),
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.975, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <GlassBackdrop material="panel" intensity={34} radius={s(20)} />

          {/* Thanh trạng thái nhỏ gọn phía trên */}
          <View style={styles.topBar}>
            {feedback ? (
              <T size={10} weight="semibold" color={colors.accentSoft} numberOfLines={1}>
                {feedback}
              </T>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
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
                <T size={10} weight="semibold" color={colors.text2}>
                  {isOnline ? 'PC đã kết nối' : isConnecting ? 'Đang kết nối…' : 'PC đang tắt'}
                </T>
              </View>
            )}
          </View>

          {/* Dãy 3 icon chức năng chuẩn phong cách glass, đồng bộ giao diện */}
          <View style={[styles.actionRow, { gap: s(7), marginTop: s(8) }]}>
            {/* 1. Streaming */}
            <Press
              autoFocus={open}
              onPress={handleStream}
              sound="confirm"
              pressScale={0.93}
              style={[
                styles.glassBtn,
                {
                  height: s(36),
                  borderRadius: s(11),
                  backgroundColor: 'rgba(102, 168, 255, 0.16)',
                  borderColor: 'rgba(102, 168, 255, 0.35)',
                },
              ]}
              accessibilityLabel="Stream phát PC"
            >
              <Play size={s(14)} color={colors.accent} fill={colors.accent} />
            </Press>

            {/* 2. Làm mới kết nối */}
            <Press
              onPress={handleReload}
              sound="navigate"
              pressScale={0.93}
              style={[
                styles.glassBtn,
                {
                  height: s(36),
                  borderRadius: s(11),
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                },
              ]}
              accessibilityLabel="Làm mới kết nối remote"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.text2} />
              ) : (
                <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                  <RotateCw size={s(14)} color={colors.text} strokeWidth={2} />
                </Animated.View>
              )}
            </Press>

            {/* 3. Đi ngủ (Sleep PC) / Đánh thức */}
            {isOnline ? (
              <Press
                onPress={() => void handleSleep()}
                sound="confirm"
                pressScale={0.93}
                style={[
                  styles.glassBtn,
                  {
                    height: s(36),
                    borderRadius: s(11),
                    backgroundColor: 'rgba(192, 132, 252, 0.15)',
                    borderColor: 'rgba(192, 132, 252, 0.32)',
                  },
                ]}
                accessibilityLabel="Ru PC ngủ & thoát"
              >
                {isSleeping ? (
                  <ActivityIndicator size="small" color="#c084fc" />
                ) : (
                  <Moon size={s(14)} color="#c084fc" strokeWidth={2} />
                )}
              </Press>
            ) : (
              <Press
                onPress={handleWake}
                sound="confirm"
                pressScale={0.93}
                style={[
                  styles.glassBtn,
                  {
                    height: s(36),
                    borderRadius: s(11),
                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                    borderColor: 'rgba(74, 222, 128, 0.32)',
                  },
                ]}
                accessibilityLabel="Đánh thức PC"
              >
                <Power size={s(14)} color={colors.success} strokeWidth={2} />
              </Press>
            )}
          </View>
        </Animated.View>
      </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: glass.panelBorder,
    backgroundColor: glass.modal,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dot: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
