// Popover kính mờ kiểu Apple bung ra từ một nút trên dock Control Center.
//
// Bung ra ĐÚNG từ nút vừa bấm (transform-origin đặt ở mũi nhọn), lò xo nhẹ như
// iOS, thu lại nhanh hơn khi đóng. Chạm ra ngoài hoặc bấm B để đóng. Dùng chung
// cho menu Guide trong stream và Control Center ở màn chính để hai nơi giống hệt.

import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useMotion } from '@/ui/motion';
import { useUi } from '@/ui/scale';
import { makeStyles } from '@/theme';
import { MenuGlassBackdrop } from '@/ui/GlassMaterial';
import { MENU_GLASS } from '@/ui/menuGlass';
import { PanelHeader } from '@/ui/PanelHeader';

/** Khung của nút neo, toạ độ trong cửa sổ (measureInWindow). */
export type PopoverAnchor = { x: number; y: number; width: number; height: number };

export function ControlPopover({
  open,
  anchor,
  title,
  icon: Icon,
  action,
  width = 340,
  blur = true,
  onClose,
  children,
}: {
  open: boolean;
  anchor: PopoverAnchor | null;
  title: string;
  icon?: LucideIcon;
  /** Nút phụ nhỏ ở góc phải tiêu đề (ví dụ "Đánh dấu đã đọc"). */
  action?: ReactNode;
  width?: number;
  /** A frozen, already blurred stream frame needs no additional native blur. */
  blur?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { s, width: screenWidth, height: screenHeight, insets } = useUi();
  const { reduceMotion } = useMotion();
  const [mounted, setMounted] = useState(open);
  const [progress] = useState(() => new Animated.Value(0));
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      const animation = Animated.timing(progress, {
        toValue: 1, duration: reduceMotion ? 0 : MENU_GLASS.openMs,
        easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
      });
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
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} focusable={false} accessibilityLabel="Đóng" />
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
        <MenuGlassBackdrop radius={s(22)} blur={blur} />
        <PanelHeader title={title} icon={Icon} action={action} onClose={onClose} appearance="glass" />
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

const useStyles = makeStyles(() => ({
  // Trên dock (zIndex 30) để popover và lớp chạm-ra-ngoài-để-đóng luôn nằm trên cùng.
  layer: { zIndex: 60, elevation: 60 },
  card: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MENU_GLASS.border,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 0,
  },
  caret: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    backgroundColor: MENU_GLASS.panelFallback,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: MENU_GLASS.border,
  },
}));
