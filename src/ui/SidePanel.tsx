import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ArrowUpRight, X, type LucideIcon } from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { openExternal } from '@/lib/open-external';
import { colors } from '@/theme';
import { Press } from './Press';
import { useUi } from './scale';
import { T } from './Text';

/**
 * Ngăn kéo bên phải phủ lên kệ game; chạm vùng tối hoặc bấm B/Back để đóng.
 * Tương đương SidePanel.tsx của web.
 */
export function SidePanel({
  title, subtitle, onClose, width = 480, bodyStyle, children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  width?: number;
  bodyStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { s, width: screenWidth, insets } = useUi();
  const enter = useRef(new Animated.Value(0)).current;
  useBack(() => { onClose(); });

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const panelWidth = Math.min(s(width), screenWidth * 0.68);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng" />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth + insets.right,
            paddingRight: insets.right,
            transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [panelWidth * 0.4, 0] }) }],
            opacity: enter,
          },
        ]}
      >
        <View style={[styles.header, { paddingHorizontal: s(16), paddingVertical: s(12) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={16} weight="semibold" numberOfLines={1} tracking={-0.025}>{title}</T>
            {subtitle ? <T size={10.5} color={colors.text3} numberOfLines={1} style={{ marginTop: s(2) }}>{subtitle}</T> : null}
          </View>
          <Press
            onPress={onClose}
            accessibilityLabel="Đóng"
            style={[styles.close, { width: s(32), height: s(32), borderRadius: s(16) }]}
          >
            <X size={s(16)} color={colors.text2} />
          </Press>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingHorizontal: s(16), paddingVertical: s(16), paddingBottom: s(24) + insets.bottom }, bodyStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** Icon + câu thông báo ở giữa cho trạng thái rỗng / lỗi trong panel. */
export function PanelMessage({ icon: Icon, message, hint }: { icon: LucideIcon; message: string; hint?: string }) {
  const { s } = useUi();
  return (
    <View style={{ minHeight: s(200), alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(20) }}>
      <Icon size={s(32)} color={colors.text4} strokeWidth={1.5} />
      <T size={13} weight="medium" color={colors.text2} style={{ marginTop: s(12), textAlign: 'center' }}>{message}</T>
      {hint ? <T size={11} color={colors.text4} leading={1.5} style={{ marginTop: s(6), textAlign: 'center' }}>{hint}</T> : null}
    </View>
  );
}

/** Nút viên thuốc mở một trang bên ngoài (Steam). */
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
  scrim: { backgroundColor: 'rgba(8,12,18,0.72)' },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13,21,32,0.97)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.lineStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  link: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
