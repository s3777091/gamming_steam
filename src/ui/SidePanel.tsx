import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, X, type LucideIcon } from 'lucide-react-native';

import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { openExternal } from '@/lib/open-external';
import { colors, glass } from '@/theme';
import { GlassBackdrop } from './GlassMaterial';
import { Press } from './Press';
import { useUi } from './scale';
import { T } from './Text';

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
  const { s, width: screenWidth, insets } = useUi();
  const [enter] = useState(() => new Animated.Value(0));
  const closingRef = useRef(false);

  const closeWithAnimation = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    enter.stopAnimation();
    Animated.timing(enter, {
      toValue: 0,
      duration: 170,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false;
        return;
      }
      onClose();
    });
  }, [enter, onClose]);

  useBack(closeWithAnimation);

  useEffect(() => {
    closingRef.current = false;
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 250,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter]);

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
            colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={styles.specularLeft}
          />

          <View style={[styles.header, { paddingHorizontal: s(16), paddingVertical: s(12) }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={16} weight="semibold" numberOfLines={1} tracking={-0.025}>{title}</T>
              {subtitle ? <T size={10.5} color={colors.text3} numberOfLines={1} style={{ marginTop: s(2) }}>{subtitle}</T> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              {action}
              <Press
                onPress={closeWithAnimation}
                sound="back"
                accessibilityLabel="Đóng"
                style={[styles.close, { width: s(32), height: s(32), borderRadius: s(16) }]}
              >
                <X size={s(15)} color={colors.text2} strokeWidth={2} />
              </Press>
            </View>
          </View>
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
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
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

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.borderSubtle,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: glass.control,
  },
  link: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
});
