import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, type LucideIcon } from 'lucide-react-native';

import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { openExternal } from '@/lib/open-external';
import { makeStyles, useTheme } from '@/theme';
import { GlassBackdrop } from './GlassMaterial';
import { Press } from './Press';
import { useUi } from './scale';
import { useMotion } from './motion';
import { T } from './Text';
import { PanelHeader } from './PanelHeader';

/**
 * Ngăn kéo bên phải Liquid Glass (iOS 26):
 * - Kính mờ siêu thực (BlurView) kết hợp bề mặt kính lỏng trong suốt.
 * - Viền trái khúc xạ ánh sáng (Specular Rim Light) tách bạch nổi bật trên nền game.
 * - Nút đóng squircle mờ tinh tế và chuyển động mượt mà.
 */
export function SidePanel({
  title, subtitle, onClose, width = 480, bodyStyle, action, headerExtension, children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  width?: number;
  bodyStyle?: StyleProp<ViewStyle>;
  action?: ReactNode;
  headerExtension?: ReactNode;
  children: ReactNode;
}) {
  const { material } = useTheme();
  const styles = useStyles();
  const { s, width: screenWidth, insets } = useUi();
  const { reduceMotion } = useMotion();
  const [enter] = useState(() => new Animated.Value(0));
  const closingRef = useRef(false);

  const closeWithAnimation = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    enter.stopAnimation();
    Animated.timing(enter, {
      toValue: 0,
      duration: reduceMotion ? 0 : 170,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
      isInteraction: false,
    }).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false;
        return;
      }
      onClose();
    });
  }, [enter, onClose, reduceMotion]);

  useBack(closeWithAnimation);

  useEffect(() => {
    closingRef.current = false;
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 0 : 250,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  const panelWidth = Math.min(s(width), screenWidth * 0.68);

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]}>
          <GlassBackdrop material="scrim" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { playUiSound('back'); closeWithAnimation(); }} accessibilityLabel="Đóng" />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth + insets.right,
              paddingRight: insets.right,
              transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [Math.min(s(36), panelWidth * 0.12), 0] }) }],
              opacity: enter,
            },
          ]}
        >
          <GlassBackdrop material="panel" intensity={34} />

          {/* Vạch sáng Specular Rim ở mép trái ngăn kéo */}
          <LinearGradient
            colors={material.panelEdge}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={styles.specularLeft}
          />

          <PanelHeader title={title} subtitle={subtitle} action={action} onClose={closeWithAnimation} />
          {headerExtension}
          <FocusScroll
            style={{ flex: 1 }}
            contentContainerStyle={[{ paddingHorizontal: s(16), paddingVertical: s(16), paddingBottom: s(24) + insets.bottom }, bodyStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </FocusScroll>
        </Animated.View>
      </View>
    </FocusLayer>
  );
}

/** Icon + câu thông báo ở giữa cho trạng thái rỗng / lỗi trong panel. */
export function PanelMessage({ icon: Icon, message, hint }: { icon: LucideIcon; message: string; hint?: string }) {
  const { colors, glass } = useTheme();
  const { s } = useUi();
  return (
    <View style={{ minHeight: s(200), alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(20) }}>
      <View
        style={{
          width: s(56),
          height: s(56),
          borderRadius: s(28),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: glass.surfaceThin,
          borderWidth: 1,
          borderColor: glass.borderSubtle,
        }}
      >
        <Icon size={s(26)} color={colors.text3} strokeWidth={1.6} />
      </View>
      <T size={13} weight="medium" color={colors.text2} style={{ marginTop: s(12), textAlign: 'center' }}>{message}</T>
      {hint ? <T size={11} color={colors.text4} leading={1.5} style={{ marginTop: s(6), textAlign: 'center' }}>{hint}</T> : null}
    </View>
  );
}

/** Nút viên thuốc mở một trang bên ngoài (Steam) phong cách Liquid Glass. */
export function SteamLink({ href, children, style }: { href: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  return (
    <Press
      onPress={() => void openExternal(href)}
      style={[styles.link, { height: s(36), paddingHorizontal: s(16), borderRadius: s(18), gap: s(8) }, style]}
    >
      <T size={11} weight="semibold" color={colors.text2}>{children}</T>
      <ArrowUpRight size={s(14)} color={colors.text2} strokeWidth={1.8} />
    </Press>
  );
}

const useStyles = makeStyles(({ glass }) => ({
  scrim: { backgroundColor: 'transparent' },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: glass.panel,
    borderLeftWidth: 1,
    borderLeftColor: glass.panelBorder,
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.40,
    shadowRadius: 28,
    elevation: 24,
    overflow: 'hidden',
  },
  specularLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1.5,
  },
  link: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: glass.control,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
}));
