// Popover kính mờ kiểu Apple bung ra từ một nút trên dock Control Center.
//
// Bung ra ĐÚNG từ nút vừa bấm (transform-origin đặt ở mũi nhọn), lò xo nhẹ như
// iOS, thu lại nhanh hơn khi đóng. Chạm ra ngoài hoặc bấm B để đóng. Dùng chung
// cho menu Guide trong stream và Control Center ở màn chính để hai nơi giống hệt.

import { BlurView } from 'expo-blur';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useMotion } from '@/ui/motion';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

/** Khung của nút neo, toạ độ trong cửa sổ (measureInWindow). */
export type PopoverAnchor = { x: number; y: number; width: number; height: number };

export function ControlPopover({
  open,
  anchor,
  title,
  icon: Icon,
  accent = 'rgba(255,255,255,0.7)',
  action,
  width = 340,
  onClose,
  children,
}: {
  open: boolean;
  anchor: PopoverAnchor | null;
  title: string;
  icon?: LucideIcon;
  accent?: string;
  /** Nút phụ nhỏ ở góc phải tiêu đề (ví dụ "Đánh dấu đã đọc"). */
  action?: ReactNode;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const { s, width: screenWidth, height: screenHeight, insets } = useUi();
  const { reduceMotion } = useMotion();
  const [mounted, setMounted] = useState(open);
  const [progress] = useState(() => new Animated.Value(0));
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      const animation = reduceMotion
        ? Animated.timing(progress, { toValue: 1, duration: 0, useNativeDriver: true })
        : Animated.spring(progress, { toValue: 1, stiffness: 340, damping: 26, mass: 0.9, useNativeDriver: true });
      animation.start();
      return () => animation.stop();
    }
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : 150,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) setMounted(false); });
    return () => animation.stop();
  }, [mounted, open, progress, reduceMotion]);

  if (!mounted) return null;

  const cardWidth = Math.min(s(width), screenWidth - s(24) - insets.left - insets.right);
  const gap = s(12);
  const caret = s(9);
  const anchorX = anchor ? anchor.x + anchor.width / 2 : screenWidth / 2;
  const anchorTop = anchor ? anchor.y : screenHeight - s(80);
  const left = Math.max(
    s(12) + insets.left,
    Math.min(anchorX - cardWidth / 2, screenWidth - cardWidth - s(12) - insets.right),
  );
  const bottom = screenHeight - anchorTop + gap;
  // Mũi nhọn luôn chỉ đúng nút, kể cả khi thân popover bị kéo vào trong mép.
  const caretLeft = Math.min(Math.max(anchorX - left - caret, s(18)), cardWidth - s(18) - caret * 2);
  const originX = caretLeft + caret;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [s(14), 0] });
  const opacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] });

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents={open ? 'box-none' : 'none'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng" />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.card,
          {
            left,
            bottom,
            width: cardWidth,
            maxHeight: Math.max(s(160), anchorTop - insets.top - s(28)),
            borderRadius: s(22),
            opacity,
            transformOrigin: `${originX}px 100%`,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: s(22) }]}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
        </View>

        <View style={[styles.header, { paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(10), gap: s(8) }]}>
          {Icon ? (
            <View style={[styles.headerIcon, { width: s(24), height: s(24), borderRadius: s(8) }]}>
              <Icon size={s(13)} color={accent} strokeWidth={2.2} />
            </View>
          ) : null}
          <T size={13} weight="semibold" color="#ffffff" style={{ flex: 1 }} numberOfLines={1}>{title}</T>
          {action}
        </View>
        <View style={{ paddingHorizontal: s(12), paddingBottom: s(12) }}>{children}</View>

        <View
          pointerEvents="none"
          style={[
            styles.caret,
            {
              left: caretLeft,
              bottom: -caret + 1,
              width: caret * 2,
              height: caret * 2,
              borderBottomRightRadius: s(4),
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Trên dock (zIndex 30) để popover và lớp chạm-ra-ngoài-để-đóng luôn nằm trên cùng.
  layer: { zIndex: 60, elevation: 60 },
  card: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  clip: { overflow: 'hidden' },
  tint: { backgroundColor: 'rgba(30,32,42,0.62)' },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  caret: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(38,40,50,0.96)',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
});
