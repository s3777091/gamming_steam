// Nội dung các popover của Control Center: Thiết bị (vòng pin kiểu widget Pin
// của iOS), Thông báo và Tài khoản (tài khoản đăng nhập app, không phải Steam).

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Bell, Camera, Check, Gamepad2, Tag, Trash2, Sparkles } from 'lucide-react-native';

import { batteryPercent } from '@/features/devices/battery';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { DEVICE_KIND_ORDER, KIND_LABEL, type LocalDevice } from '@/features/devices/useInputDevices';
import type { AppNotification } from '@/features/library/types';
import { getBackendBaseUrl } from '@/lib/config';
import { listGameScreenshots } from '@/lib/game-screenshots';
import { resolveProfileAvatarUri } from '@/lib/profile-avatar';
import { makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { useMenuGlass, menuGlassFrom } from '@/ui/menuGlass';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const APPLE_GREEN = '#34c759';
const APPLE_YELLOW = '#ffcc00';
const APPLE_RED = '#ff453a';

function ringColor(percent: number): string {
  if (percent <= 15) return APPLE_RED;
  if (percent <= 35) return APPLE_YELLOW;
  return APPLE_GREEN;
}

/** Mỗi mục trượt nhẹ lên và hiện dần, lệch nhau một nhịp như danh sách của iOS. */
function Stagger({ index, children }: { index: number; children: React.ReactNode }) {
  const { reduceMotion } = useMotion();
  const [value] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) { value.setValue(1); return; }
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 320,
      delay: 60 + index * 45,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reduceMotion, value]);
  return (
    <Animated.View
      style={{
        opacity: value,
        transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------------ thiết bị

function BatteryRing({ device, index }: { device: LocalDevice; index: number }) {
  const MENU_GLASS = useMenuGlass();
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const size = s(58);
  const stroke = s(5);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = device.battery !== null ? batteryPercent(device.battery) : null;
  const [fill] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) { fill.setValue(1); return; }
    const animation = Animated.timing(fill, {
      toValue: 1,
      duration: 900,
      delay: 120 + index * 70,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fill, index, reduceMotion]);

  const target = percent !== null ? percent / 100 : 1;
  const dashOffset = fill.interpolate({ inputRange: [0, 1], outputRange: [circumference, circumference * (1 - target)] });
  const color = percent !== null ? ringColor(percent) : 'rgba(255,255,255,0.42)';
  const Icon = KIND_ICONS[device.kind];

  return (
    <Stagger index={index}>
      <View style={{ width: s(74), alignItems: 'center' }}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={MENU_GLASS.border} strokeWidth={stroke} fill={MENU_GLASS.inset} />
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={[circumference, circumference]}
              strokeDashoffset={dashOffset}
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <Icon size={s(20)} color="#ffffff" strokeWidth={1.9} />
        </View>
        <T size={11} weight="semibold" color="#ffffff" tabular style={{ marginTop: s(6) }}>
          {percent !== null ? `${percent}%` : 'Đã nối'}
        </T>
        <T size={9} color="rgba(255,255,255,0.5)" numberOfLines={1} style={{ marginTop: s(1), maxWidth: s(70) }}>
          {device.name || KIND_LABEL[device.kind]}
        </T>
      </View>
    </Stagger>
  );
}

export function DevicesPanel({ devices }: { devices: LocalDevice[] }) {
  const styles = useStyles();
  const { s } = useUi();
  const sorted = useMemo(
    () => [...devices].sort((a, b) => DEVICE_KIND_ORDER.indexOf(a.kind) - DEVICE_KIND_ORDER.indexOf(b.kind)),
    [devices],
  );
  if (sorted.length === 0) {
    return (
      <Stagger index={0}>
        <View style={[styles.empty, { paddingVertical: s(16), borderRadius: s(14), gap: s(6) }]}>
          <Gamepad2 size={s(22)} color="rgba(255,255,255,0.4)" />
          <T size={11} color="rgba(255,255,255,0.6)">Chưa có tay cầm nào được nối</T>
          <T size={9.5} color="rgba(255,255,255,0.4)">Cảm ứng màn hình đang điều khiển PC</T>
        </View>
      </Stagger>
    );
  }
  return (
    <View style={[styles.inset, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingVertical: s(12), borderRadius: s(16), rowGap: s(10) }]}>
      {sorted.map((device, index) => <BatteryRing key={device.id} device={device} index={index} />)}
    </View>
  );
}

// ------------------------------------------------------------------ thông báo

function notificationLine(item: AppNotification, accent: string): { kind: string; title: string; detail: string; image: string | null; Icon: typeof Bell; tint: string } {
  if (item.type === 'discount') {
    return { kind: 'Ưu đãi', title: item.gameTitle, detail: `Giảm ${item.discountPercent}% trên Steam`, image: item.imageUrl, Icon: Tag, tint: '#34c759' };
  }
  if (item.type === 'update') {
    return { kind: 'Cập nhật', title: item.gameTitle, detail: item.title, image: item.gameImageUrl, Icon: Sparkles, tint: accent };
  }
  return { kind: 'Đã gỡ', title: item.gameTitle, detail: item.message || 'Đã gỡ khỏi máy tính', image: item.gameImageUrl ?? null, Icon: Trash2, tint: '#ff9f0a' };
}

export function NotificationsPanel({ notifications }: { notifications: AppNotification[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const shown = notifications.slice(0, 4);
  if (shown.length === 0) {
    return (
      <Stagger index={0}>
        <View style={[styles.empty, { paddingVertical: s(16), borderRadius: s(14), gap: s(6) }]}>
          <Check size={s(20)} color="rgba(255,255,255,0.4)" />
          <T size={11} color="rgba(255,255,255,0.6)">Không có thông báo mới</T>
        </View>
      </Stagger>
    );
  }
  return (
    <View style={{ gap: s(6) }}>
      {shown.map((item, index) => {
        const line = notificationLine(item, colors.accentSoft);
        return (
          <Stagger key={item.id} index={index}>
            <View style={[styles.inset, styles.row, { padding: s(8), gap: s(10), borderRadius: s(14) }]}>
              <View style={[styles.thumb, { width: s(58), height: s(28), borderRadius: s(7) }]}>
                {line.image ? <Img source={{ uri: line.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={[styles.row, { gap: s(4) }]}>
                  <line.Icon size={s(9)} color={line.tint} strokeWidth={2.4} />
                  <T size={9} weight="semibold" color={line.tint}>{line.kind}</T>
                </View>
                <T size={11} weight="semibold" color="#ffffff" numberOfLines={1} style={{ marginTop: s(1) }}>{line.title}</T>
                <T size={9.5} color="rgba(255,255,255,0.55)" numberOfLines={1}>{line.detail}</T>
              </View>
            </View>
          </Stagger>
        );
      })}
      {notifications.length > shown.length ? (
        <T size={9.5} color="rgba(255,255,255,0.4)" style={{ textAlign: 'center', marginTop: s(2) }}>
          +{notifications.length - shown.length} thông báo khác
        </T>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ tài khoản

/** Avatar tài khoản app: ảnh nếu có, không thì chữ cái đầu trên nền gradient. */
export function UserAvatar({ uri, name, size, ring = false }: { uri: string | null; name: string; size: number; ring?: boolean }) {
  const { colors, material } = useTheme();
  const initial = (name.trim()[0] || '?').toLocaleUpperCase('vi');
  // Avatar lưu dạng đường dẫn tương đối (/storage/v1/object/public/avatars/…); Image của RN
  // không có origin nên phải ghép base URL của region đang dùng, không thì ảnh im lặng không hiện.
  const resolved = resolveProfileAvatarUri(uri, getBackendBaseUrl());
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(resolved && failed !== resolved);
  const inner = ring ? size - 4 : size;
  const body = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {showImage && resolved ? (
        <Img source={{ uri: resolved }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailed(resolved)} />
      ) : (
        <>
          <LinearGradient colors={[colors.primary, colors.primaryDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <T weight="bold" color="#ffffff" style={{ fontSize: inner * 0.42, lineHeight: inner * 0.52 }}>{initial}</T>
        </>
      )}
    </View>
  );
  if (!ring) return body;
  return (
    <LinearGradient
      colors={material.frame}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      {body}
    </LinearGradient>
  );
}

export function ProfilePanel({
  name,
  email,
  avatarUrl,
  status,
}: {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  /** Dòng trạng thái có chấm xanh, ví dụ "Đang điều khiển PC". */
  status: string;
}) {
  const styles = useStyles();
  const { s } = useUi();
  const [shots, setShots] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listGameScreenshots(controller.signal)
      .then((items) => setShots(items.length))
      .catch(() => { if (!controller.signal.aborted) setShots(null); });
    return () => controller.abort();
  }, []);

  return (
    <View style={{ gap: s(8) }}>
      <Stagger index={0}>
        <View style={[styles.inset, styles.row, { padding: s(12), gap: s(12), borderRadius: s(16) }]}>
          <UserAvatar uri={avatarUrl} name={name} size={s(54)} ring />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={14} weight="bold" color="#ffffff" numberOfLines={1}>{name}</T>
            {email ? <T size={10} color="rgba(255,255,255,0.5)" numberOfLines={1} style={{ marginTop: s(1) }}>{email}</T> : null}
            <View style={[styles.row, { gap: s(5), marginTop: s(5) }]}>
              <View style={[styles.dot, { width: s(6), height: s(6), borderRadius: s(3) }]} />
              <T size={9.5} weight="semibold" color={APPLE_GREEN}>{status}</T>
            </View>
          </View>
        </View>
      </Stagger>
      <Stagger index={1}>
        <View style={[styles.inset, styles.row, { paddingHorizontal: s(12), paddingVertical: s(10), gap: s(10), borderRadius: s(14) }]}>
          <View style={[styles.rowIcon, { width: s(26), height: s(26), borderRadius: s(8) }]}>
            <Camera size={s(13)} color="#ffffff" />
          </View>
          <T size={11} weight="medium" color="#ffffff" style={{ flex: 1 }}>Ảnh chụp game</T>
          <T size={10.5} color="rgba(255,255,255,0.5)" tabular>{shots === null ? '—' : `${shots} ảnh`}</T>
        </View>
      </Stagger>
    </View>
  );
}

const useStyles = makeStyles(({ glass }) => ({
  inset: {
    backgroundColor: menuGlassFrom(glass).inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: menuGlassFrom(glass).border,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: menuGlassFrom(glass).inset,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { overflow: 'hidden', backgroundColor: menuGlassFrom(glass).control },
  dot: { backgroundColor: APPLE_GREEN },
  rowIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: menuGlassFrom(glass).controlActive },
}));
