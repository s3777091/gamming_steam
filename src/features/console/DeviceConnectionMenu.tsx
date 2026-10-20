import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { MonitorSmartphone, Settings } from 'lucide-react-native';

import { batteryColor, batteryPercent } from '@/features/devices/battery';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { DEVICE_KIND_ORDER, KIND_LABEL, type LocalDevice } from '@/features/devices/useInputDevices';
import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { makeStyles, useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type DeviceConnectionMenuProps = {
  open: boolean;
  anchorRef?: RefObject<View | null>;
  devices: LocalDevice[];
  onClose: () => void;
  /** Mở Cài đặt > Thiết bị (chạm vào một thiết bị hoặc nút bánh răng). */
  onOpenSettings: () => void;
};

/** Thanh pin nhỏ: vỏ + phần ruột tô theo % và màu theo mức pin (không kèm số, % nằm ở accessibilityLabel). */
function BatteryGauge({ percent }: { percent: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const color = batteryColor(percent, colors);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={[styles.gaugeShell, { width: s(20), height: s(8), borderRadius: s(2.5), padding: s(1) }]}>
        <View style={{ width: `${Math.max(8, percent)}%`, height: '100%', borderRadius: s(1.5), backgroundColor: color }} />
      </View>
      <View style={{ width: s(1.5), height: s(3.5), borderRadius: s(1), backgroundColor: 'rgba(255,255,255,0.45)', marginLeft: s(0.5) }} />
    </View>
  );
}

function DeviceTile({
  device,
  width,
  height,
  autoFocus,
  onPress,
}: {
  device: LocalDevice;
  width?: number;
  height: number;
  autoFocus: boolean;
  onPress: () => void;
}) {
  const { glass, colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const Icon = KIND_ICONS[device.kind];
  const percent = device.kind === 'controller' && device.battery !== null ? batteryPercent(device.battery) : null;
  const label = percent !== null ? `${device.name}, pin ${percent}%` : `${KIND_LABEL[device.kind]}: ${device.name}`;
  return (
    <Press
      autoFocus={autoFocus}
      onPress={onPress}
      sound="navigate"
      pressScale={0.93}
      accessibilityLabel={label}
      style={[
        styles.tile,
        {
          width,
          flex: width ? undefined : 1,
          height,
          borderRadius: s(13),
          gap: s(4),
          backgroundColor: device.kind === 'controller' ? glass.surfaceHighlight : glass.control,
          borderColor: device.kind === 'controller' ? glass.borderAccent : glass.controlBorder,
        },
      ]}
    >
      <Icon
        size={s(17)}
        color={percent !== null ? batteryColor(percent, colors) : device.kind === 'controller' ? colors.accentSoft : colors.text}
        strokeWidth={1.9}
      />
      {percent !== null ? <BatteryGauge percent={percent} /> : null}
    </Press>
  );
}

/** Tính kích thước khung menu và tile theo số lượng thiết bị thực tế đang nối (luôn trên 1 hàng ngang) */
function getMenuDimensions(count: number, s: (v: number) => number) {
  if (count <= 0) {
    return { cardWidth: s(168), tileWidth: s(50), tileGap: s(8), paddingX: s(12) };
  }
  if (count === 1) {
    return { cardWidth: s(152), tileWidth: s(56), tileGap: s(8), paddingX: s(12) };
  }
  if (count === 2) {
    return { cardWidth: s(160), tileWidth: s(54), tileGap: s(8), paddingX: s(12) };
  }
  if (count === 3) {
    return { cardWidth: s(204), tileWidth: s(50), tileGap: s(8), paddingX: s(12) };
  }
  if (count === 4) {
    return { cardWidth: s(252), tileWidth: s(48), tileGap: s(7), paddingX: s(12) };
  }
  // count >= 5
  const tileWidth = s(44);
  const tileGap = s(6);
  const paddingX = s(10);
  const contentWidth = count * tileWidth + (count - 1) * tileGap;
  const cardWidth = contentWidth + paddingX * 2 + s(10);
  return { cardWidth, tileWidth, tileGap, paddingX };
}

/**
 * Menu thiết bị đang kết nối, thả xuống từ cụm icon thiết bị trên header:
 * - Cùng hiệu ứng slide out và khung glass với menu Remote PC.
 * - Tự động canh chỉnh kích thước khung và tile theo số lượng thiết bị bên trong.
 * - Mỗi thiết bị là một icon; icon tay cầm tô màu theo mức pin, kèm thanh pin (không ghi số).
 */
export function DeviceConnectionMenu({ open, anchorRef, devices, onClose, onOpenSettings }: DeviceConnectionMenuProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s, width: screenWidth, insets } = useUi();
  const [anim] = useState(() => new Animated.Value(0));
  const closingRef = useRef(false);
  const [anchorPos, setAnchorPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Đo tọa độ cụm icon thiết bị để thả menu ngay bên dưới chính giữa cụm icon
  useEffect(() => {
    if (open && anchorRef?.current) {
      const measure = () => {
        anchorRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) setAnchorPos({ x, y, width, height });
        });
      };
      measure();
      const t1 = setTimeout(measure, 70);
      const t2 = setTimeout(measure, 270);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [open, anchorRef]);

  // Hiệu ứng slide trượt mượt mà từ trên xuống với curve ease-out
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
      onClose();
      after?.();
    });
  }, [anim, onClose]);

  useBack(() => {
    closeWithAnimation();
  }, open);

  if (!open) return null;

  const sorted = [...devices].sort((a, b) => DEVICE_KIND_ORDER.indexOf(a.kind) - DEVICE_KIND_ORDER.indexOf(b.kind));
  const tall = sorted.some((device) => device.kind === 'controller' && device.battery !== null);
  const { cardWidth: rawCardWidth, tileWidth, tileGap, paddingX } = getMenuDimensions(sorted.length, s);
  const cardWidth = Math.min(rawCardWidth, screenWidth - s(24) - insets.left - insets.right);
  const tileHeight = s(tall ? 52 : 46);

  const fallbackTop = s(48) + insets.top + s(4);
  const fallbackRight = Math.max(s(16), s(22) + insets.right + s(140));

  const topPos = anchorPos ? anchorPos.y + anchorPos.height + s(6) : fallbackTop;
  const leftPos = anchorPos
    ? Math.max(
        s(12) + insets.left,
        Math.min(anchorPos.x + anchorPos.width / 2 - cardWidth / 2, screenWidth - cardWidth - s(12) - insets.right),
      )
    : undefined;

  const openSettings = () => closeWithAnimation(onOpenSettings);

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]}>
        {/* Lớp nền trong suốt bắt chạm ngoài để đóng */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.32)', opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeWithAnimation()} focusable={false} accessibilityLabel="Đóng menu thiết bị" />
        </Animated.View>

        {/* Khung nổi glass trượt xuống từ trên với ease-out */}
        <Animated.View
          style={[
            styles.glassCard,
            {
              width: cardWidth,
              top: topPos,
              left: leftPos,
              right: leftPos !== undefined ? undefined : fallbackRight,
              borderRadius: s(18),
              paddingHorizontal: paddingX,
              paddingTop: s(9),
              paddingBottom: s(10),
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.975, 1] }) },
              ],
            },
          ]}
        >
          <GlassBackdrop material="panel" intensity={34} radius={s(20)} />

          {/* Thanh tiêu đề nhỏ gọn */}
          <View style={styles.topBar}>
            <T size={10} weight="semibold" color={colors.text2} numberOfLines={1}>
              {sorted.length ? `Thiết bị · ${sorted.length}` : 'Thiết bị'}
            </T>
            <Press
              onPress={openSettings}
              sound="navigate"
              autoFocus={sorted.length === 0}
              focusVariant="card"
              focusRadius={s(10)}
              pressScale={0.92}
              accessibilityLabel="Mở cài đặt thiết bị"
              style={[styles.closeBtn, { width: s(20), height: s(20), borderRadius: s(10) }]}
            >
              <Settings size={s(11)} color={colors.text3} />
            </Press>
          </View>

          {sorted.length ? (
            <View style={[styles.tileRow, { gap: tileGap, marginTop: s(8) }]}>
              {sorted.map((device, index) => (
                <DeviceTile
                  key={device.id}
                  device={device}
                  width={sorted.length === 1 ? tileWidth : undefined}
                  height={tileHeight}
                  autoFocus={index === 0}
                  onPress={openSettings}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.empty, { gap: s(6), marginTop: s(8), height: s(36), borderRadius: s(11) }]}>
              <MonitorSmartphone size={s(14)} color={colors.text3} strokeWidth={1.8} />
              <T size={10} weight="medium" color={colors.text3}>Chưa có thiết bị nào</T>
            </View>
          )}
        </Animated.View>
      </View>
    </FocusLayer>
  );
}

const useStyles = makeStyles(({ glass }) => ({
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
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.surface,
    borderWidth: 1,
    borderColor: glass.border,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 1,
  },
  gaugeShell: {
    borderWidth: 1,
    borderColor: glass.controlBorderActive,
    justifyContent: 'center',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.surfaceThin,
    borderWidth: 1,
    borderColor: glass.borderSubtle,
  },
}));
