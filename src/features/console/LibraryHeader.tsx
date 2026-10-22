import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { Bell, Gamepad2, Monitor, MonitorSmartphone, Settings, ShoppingBag } from 'lucide-react-native';

import { batteryColor, batteryPercent, lowestControllerBattery } from '@/features/devices/battery';
import { DEVICE_KIND_ORDER, type LocalDevice } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { formatClock } from '@/features/library/format';
import type { SteamProfile, StoreTab } from '@/features/library/types';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { alpha, AvatarFrame, HeaderAccent, makeStyles, SeasonalIcon, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { MenuGlassBackdrop } from '@/ui/GlassMaterial';
import { MENU_GLASS } from '@/ui/menuGlass';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ProgressRing } from './DownloadViews';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';
import { CONSOLE } from './consoleVisuals';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PROFILE_HOLD_DELAY_MS = 80;
const PROFILE_HOLD_DURATION_MS = 460;

const TABS: { id: StoreTab; label: string }[] = [
  { id: 'games', label: 'Games' },
  { id: 'store', label: 'Store' },
  { id: 'pc', label: 'PC' },
];

// Kích thước chuẩn cho mỗi tab để indicator trượt bằng GPU (useNativeDriver: true), không phụ thuộc đo layout.
const TAB_ITEM_WIDTH = 66;

/** Cụm icon thiết bị đang nối:
 *  - Bình thường (đóng): các icon đè lên nhau tạo thành stack gọn gàng.
 *  - Khi chạm mở: các icon tách ra bình thường với hiệu ứng ease-out, nút nở rộng mượt mà.
 *  - Canh chỉnh linh hoạt theo số lượng icon và thiết bị thực tế bên trong.
 */
function DeviceStatusButton({ devices, open, onPress }: { devices: LocalDevice[]; open: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [anim] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : 160,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, open, reduceMotion]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => DEVICE_KIND_ORDER.indexOf(a.kind) - DEVICE_KIND_ORDER.indexOf(b.kind));
  }, [devices]);

  const controllerBattery = useMemo(() => lowestControllerBattery(devices), [devices]);
  const displayDevices = useMemo(() => sortedDevices.slice(0, 4), [sortedDevices]);
  const overflowCount = sortedDevices.length > 4 ? sortedDevices.length - 4 : 0;
  const N = displayDevices.length;

  const ICON_WRAP = s(22);
  const ICON_SIZE = s(14.5);
  const SEPARATED_GAP = s(6);
  const OVERLAP_OFFSET = s(13); // Khoảng cách giữa các icon khi đè lên nhau (overlap 9dp)
  const SHIFT_DELTA = (ICON_WRAP + SEPARATED_GAP) - OVERLAP_OFFSET; // 15dp
  const PADDING_H = s(9);
  const overflowWidth = overflowCount > 0 ? s(16) : 0;

  // Tính độ rộng theo số lượng icon và thiết bị (pin hiện bằng màu icon tay cầm, không chiếm chỗ)
  let collapsedContentWidth = ICON_WRAP;
  let separatedContentWidth = ICON_WRAP;

  if (N >= 2) {
    collapsedContentWidth = ICON_WRAP + (N - 1) * OVERLAP_OFFSET + overflowWidth;
    separatedContentWidth = ICON_WRAP + (N - 1) * (ICON_WRAP + SEPARATED_GAP) + overflowWidth;
  }

  const collapsedTotalWidth = collapsedContentWidth + PADDING_H * 2;
  const separatedTotalWidth = separatedContentWidth + PADDING_H * 2;

  const animatedWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedTotalWidth, separatedTotalWidth],
  });

  const pillBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', MENU_GLASS.controlActive],
  });

  const pillBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [MENU_GLASS.border, MENU_GLASS.borderActive],
  });

  const accessibilityLabel = controllerBattery !== null
    ? `Thiết bị đang kết nối, pin tay cầm ${controllerBattery}%`
    : (N > 0 ? `Thiết bị đang kết nối: ${N} thiết bị` : 'Thiết bị đang kết nối');

  return (
    <Press
      onPress={onPress}
      sound="confirm"
      accessibilityLabel={accessibilityLabel}
      focusRadius={s(16)}
      focusVariant="quiet"
      style={{ borderRadius: s(16) }}
    >
      <Animated.View
        style={[
          styles.devices,
          {
            width: animatedWidth,
            height: s(32),
            borderRadius: s(16),
            paddingHorizontal: PADDING_H,
            backgroundColor: pillBg,
            borderColor: pillBorder,
            overflow: 'hidden',
          },
        ]}
      >
        <MenuGlassBackdrop variant="control" radius={s(16)} />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: N > 0 ? 'flex-start' : 'center',
          }}
        >
          {N > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {displayDevices.map((device, i) => {
                const Icon = KIND_ICONS[device.kind];
                const translateX = anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-i * SHIFT_DELTA, 0],
                });

                return (
                  <Animated.View
                    key={device.id}
                    style={[
                      styles.deviceIconWrapper,
                      {
                        width: ICON_WRAP,
                        height: ICON_WRAP,
                        borderRadius: ICON_WRAP / 2,
                        marginLeft: i > 0 ? SEPARATED_GAP : 0,
                        zIndex: i + 1,
                        transform: [{ translateX }],
                        backgroundColor: i === 0 ? 'transparent' : anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [alpha(colors.panelSolid, 0.95), alpha(colors.panelSolid, 0)],
                        }),
                        borderWidth: i === 0 ? 0 : 1.5,
                        borderColor: i === 0 ? 'transparent' : anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [alpha(colors.cardRaised, 0.9), alpha(colors.cardRaised, 0)],
                        }),
                      },
                    ]}
                  >
                    <Icon
                      size={ICON_SIZE}
                      color={
                        device.kind === 'controller' && device.battery !== null
                          ? batteryColor(batteryPercent(device.battery), colors)
                          : CONSOLE.ink
                      }
                      strokeWidth={1.8}
                    />
                  </Animated.View>
                );
              })}

              {overflowCount > 0 ? (
                <Animated.View
                  style={{
                    marginLeft: s(4),
                    transform: [{
                      translateX: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-(N - 1) * SHIFT_DELTA, 0],
                      }),
                    }],
                  }}
                >
                  <T size={9.6} weight="bold" color={CONSOLE.muted} tabular>
                    +{overflowCount}
                  </T>
                </Animated.View>
              ) : null}
            </View>
          ) : (
            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <MonitorSmartphone size={ICON_SIZE} color={colors.text3} strokeWidth={1.8} />
            </View>
          )}
        </View>
      </Animated.View>
    </Press>
  );
}

/** Nút hiển thị trạng thái kết nối giữa thiết bị remote và PC; bấm để mở menu điều khiển. */
function RemoteStatusButton({
  open,
  online,
  stage,
  reachable,
  onPress,
  anchorRef,
}: {
  open: boolean;
  online: boolean | null;
  stage?: string;
  reachable: boolean;
  onPress: () => void;
  anchorRef?: RefObject<View | null>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const isOnline = reachable || online === true;
  const isConnecting = stage === 'network' || stage === 'signal_sent' || (online === null && !reachable);
  const statusColor = isOnline ? colors.success : isConnecting ? colors.warning : colors.text4;

  return (
    <View ref={anchorRef} collapsable={false} style={styles.remoteButtonWrap}>
      <Press
        onPress={onPress}
        sound="confirm"
        focusVariant="quiet"
        accessibilityLabel={`Kết nối PC: ${isOnline ? 'Đã kết nối' : isConnecting ? 'Đang kết nối' : 'Ngoại tuyến'}`}
        style={[
          styles.remoteButton,
          {
            width: s(32),
            height: s(32),
            borderRadius: s(16),
            backgroundColor: open ? MENU_GLASS.controlActive : 'transparent',
            borderColor: open ? MENU_GLASS.borderActive : MENU_GLASS.border,
          },
        ]}
      >
        <MenuGlassBackdrop variant="control" radius={s(16)} />
        <Monitor
          size={s(15)}
          color={isOnline ? CONSOLE.ink : CONSOLE.muted}
          strokeWidth={1.8}
        />
      </Press>
      <View
        pointerEvents="none"
        style={[
          styles.statusDot,
          {
            width: s(8),
            height: s(8),
            borderRadius: s(4),
            backgroundColor: statusColor,
            top: s(1.5),
            right: s(1.5),
          },
        ]}
      />
    </View>
  );
}

function SteamAccountButton({
  profile,
  onPress,
  onLongPress,
}: {
  profile: SteamProfile | null;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const [holding, setHolding] = useState(false);
  const [holdProgress] = useState(() => new Animated.Value(0));
  const holdDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const longPressTriggered = useRef(false);

  const clearHold = useCallback(() => {
    if (holdDelayTimer.current) {
      clearTimeout(holdDelayTimer.current);
      holdDelayTimer.current = null;
    }
    if (holdAnim.current) {
      holdAnim.current.stop();
      holdAnim.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearHold();
    holdProgress.stopAnimation();
  }, [clearHold, holdProgress]);

  const handlePressIn = useCallback(() => {
    longPressTriggered.current = false;
    clearHold();
    if (!onLongPress) return;
    holdDelayTimer.current = setTimeout(() => {
      holdDelayTimer.current = null;
      setHolding(true);
      holdProgress.setValue(0);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      playUiSound('focus');
      const anim = Animated.timing(holdProgress, {
        toValue: 1,
        duration: PROFILE_HOLD_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      });
      holdAnim.current = anim;
      anim.start(({ finished }) => {
        if (!finished) return;
        holdAnim.current = null;
        longPressTriggered.current = true;
        setHolding(false);
        holdProgress.setValue(0);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        playUiSound('transition');
        onLongPress();
      });
    }, PROFILE_HOLD_DELAY_MS);
  }, [clearHold, holdProgress, onLongPress]);

  const handlePressOut = useCallback(() => {
    clearHold();
    if (longPressTriggered.current) return;
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setHolding(false);
    });
  }, [clearHold, holdProgress]);

  const handlePress = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    playUiSound('select');
    onPress();
  }, [onPress]);

  const ringSize = s(44);
  const ringOffset = (s(32) - ringSize) / 2;
  const stroke = s(2.5);
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  const haloScale = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.14],
  });
  const haloOpacity = holdProgress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.75, 1],
  });

  return (
    <Press
      sound={false}
      focusVariant="quiet"
      pressScale={0.9}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={profile?.personaName ? `Hồ sơ ${profile.personaName}` : 'Xem hồ sơ'}
      accessibilityHint={onLongPress ? 'Nhấn để xem hồ sơ, nhấn giữ để mở menu điều khiển' : undefined}
      style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
    >
      {holding ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ringOffset,
            top: ringOffset,
            width: ringSize,
            height: ringSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              backgroundColor: alpha(colors.accent, 0.24),
              borderWidth: 1,
              borderColor: alpha(colors.accentSoft, 0.45),
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            }}
          />
          <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={alpha(colors.white, 0.2)}
              strokeWidth={stroke}
              fill="none"
            />
            <AnimatedCircle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={colors.accentSoft}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={[circumference, circumference]}
              strokeDashoffset={dashOffset}
              rotation={-90}
              origin={`${ringSize / 2}, ${ringSize / 2}`}
            />
          </Svg>
        </View>
      ) : null}
      <AvatarFrame size={s(32)}>
        <View
          style={[
            styles.avatar,
            {
              width: s(32),
              height: s(32),
              borderRadius: s(16),
              borderColor: holding ? colors.accentSoft : undefined,
            },
          ]}
        >
          {profile?.avatarUrl ? (
            <Img source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: s(16) }} contentFit="cover" />
          ) : (
            <Gamepad2 size={s(16)} color="rgba(255,255,255,0.7)" strokeWidth={1.7} />
          )}
          {profile ? (
            <View
              style={[
                styles.presence,
                { width: s(8), height: s(8), borderRadius: s(4), backgroundColor: profile.personState > 0 ? colors.accent : 'rgba(255,255,255,0.35)' },
              ]}
            />
          ) : null}
        </View>
      </AvatarFrame>
    </Press>
  );
}

function HeaderClock() {
  const styles = useStyles();
  const { s } = useUi();
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      setClock(formatClock(now));
      timer = setTimeout(schedule, (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 20);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={[styles.clockBadge, { height: s(32), paddingHorizontal: s(10), borderRadius: s(16) }]}>
      <MenuGlassBackdrop variant="control" radius={s(16)} />
      <HeaderAccent />
      <T size={13} weight="semibold" color="rgba(255,255,255,0.95)" tabular>{clock}</T>
    </View>
  );
}

function ConsoleTabItem({
  tab,
  active,
  onPress,
  tabWidth,
}: {
  tab: { id: StoreTab; label: string };
  active: boolean;
  onPress: () => void;
  tabWidth: number;
}) {
  const { colors } = useTheme();
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [anim] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: reduceMotion ? 0 : TAB_MOTION_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, anim, reduceMotion]);

  const Icon = tab.id === 'games' ? Gamepad2 : tab.id === 'store' ? ShoppingBag : Monitor;

  return (
    <Press
      focusable={false}
      sound={false}
      pressScale={0.96}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        width: tabWidth,
        height: s(28),
        borderRadius: s(14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: s(6),
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.65, 1],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1.02],
              }),
            },
          ],
        }}
      >
        <Icon size={s(13)} color={CONSOLE.ink} strokeWidth={1.8} />
        <T size={11} weight="semibold" color={colors.white}>{tab.label}</T>
      </Animated.View>
    </Press>
  );
}

function ConsoleTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: StoreTab;
  onTabChange: (tab: StoreTab) => void;
}) {
  const styles = useStyles();
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const tabWidth = s(TAB_ITEM_WIDTH);

  const tabIndex = useMemo(() => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab]);

  const targetX = tabIndex * tabWidth;
  const [indicatorX] = useState(() => new Animated.Value(targetX));
  const prevTabIndex = useRef(tabIndex);
  const prevTabWidth = useRef(tabWidth);

  useEffect(() => {
    if (prevTabWidth.current !== tabWidth) {
      prevTabWidth.current = tabWidth;
      indicatorX.setValue(targetX);
    }
  }, [indicatorX, targetX, tabWidth]);

  useEffect(() => {
    if (prevTabIndex.current !== tabIndex) {
      prevTabIndex.current = tabIndex;
      const animation = Animated.timing(indicatorX, {
        toValue: targetX,
        duration: reduceMotion ? 0 : TAB_MOTION_MS,
        easing: TAB_MOTION_EASING,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }
  }, [indicatorX, reduceMotion, tabIndex, targetX]);

  return (
    <View
      style={[
        styles.tabBarCapsule,
        {
          flexDirection: 'row',
          height: s(32),
          borderRadius: s(16),
          alignItems: 'center',
          position: 'relative',
          paddingHorizontal: s(2),
          overflow: 'hidden',
        },
      ]}
      accessibilityRole="tablist"
    >
      <MenuGlassBackdrop variant="control" radius={s(16)} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIndicator,
          {
            position: 'absolute',
            top: s(2),
            bottom: s(2),
            left: s(2),
            borderRadius: s(14),
            width: tabWidth,
            transform: [{ translateX: indicatorX }],
          },
        ]}
      />
      {TABS.map((tab) => (
        <ConsoleTabItem
          key={tab.id}
          tab={tab}
          active={activeTab === tab.id}
          onPress={() => onTabChange(tab.id)}
          tabWidth={tabWidth}
        />
      ))}
    </View>
  );
}

function HeaderSearchContainer({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [rendered, setRendered] = useState(visible);

  if (visible && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setRendered(false);
      }
    });
  }, [visible, anim]);

  if (!rendered) return null;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function LibraryHeader({
  activeTab,
  onTabChange,
  search,
  steamProfile,
  onOpenProfile,
  onOpenControlCenter,
  onOpenSettings,
  onOpenNotifications,
  unreadCount = 0,
  notificationCount,
  downloadCount = 0,
  downloadPercent = null,
  bellRef,
  remoteAnchorRef,
  remoteMenuOpen,
  onToggleRemoteMenu,
  remoteOnline,
  remoteStage,
  remoteReachable,
  devices = [],
  deviceAnchorRef,
  deviceMenuOpen,
  onToggleDeviceMenu,
}: {
  activeTab: StoreTab;
  onTabChange: (tab: StoreTab) => void;
  /** Ô tìm kiếm Store, chỉ hiện ở tab Store. */
  search: ReactNode;
  steamProfile: SteamProfile | null;
  onOpenProfile: () => void;
  /** Nhấn giữ ảnh hồ sơ để mở Control Center / Guide Menu trên màn chính. */
  onOpenControlCenter?: () => void;
  onOpenSettings: (category: 'quality' | 'devices') => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  notificationCount?: number;
  /** Số lượt tải Steam đang chạy: cộng vào huy hiệu trên chuông. */
  downloadCount?: number;
  /** Tiến trình lượt tải chính, vẽ thành vòng quanh chuông; null khi không có. */
  downloadPercent?: number | null;
  /** Đích của hiệu ứng thẻ game bay vào thông báo. */
  bellRef?: RefObject<View | null>;
  /** Điểm neo đo tọa độ để menu remote PC thả xuống chuẩn xác. */
  remoteAnchorRef?: RefObject<View | null>;
  /** Trạng thái mở menu điều khiển remote PC. */
  remoteMenuOpen?: boolean;
  onToggleRemoteMenu?: () => void;
  remoteOnline?: boolean | null;
  remoteStage?: string;
  remoteReachable?: boolean;
  /** Thiết bị đang nối (từ useInputDevices) — cụm icon + % pin tay cầm. */
  devices?: LocalDevice[];
  /** Điểm neo để menu thiết bị thả xuống ngay dưới cụm icon. */
  deviceAnchorRef?: RefObject<View | null>;
  deviceMenuOpen?: boolean;
  /** Không truyền thì chạm cụm icon mở thẳng Cài đặt > Thiết bị. */
  onToggleDeviceMenu?: () => void;
}) {
  const { glass, colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const totalNotifications = notificationCount !== undefined
    ? notificationCount
    : (unreadCount + downloadCount);

  return (
    <View style={[styles.header, { height: s(44) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
        <HeaderClock />
        <ConsoleTabs activeTab={activeTab} onTabChange={onTabChange} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), height: s(32) }}>
        <HeaderSearchContainer visible={activeTab === 'store'}>
          {search}
        </HeaderSearchContainer>
        <View ref={deviceAnchorRef} collapsable={false}>
          <DeviceStatusButton
            devices={devices}
            open={Boolean(deviceMenuOpen)}
            onPress={onToggleDeviceMenu ?? (() => onOpenSettings('devices'))}
          />
        </View>
        {onToggleRemoteMenu ? (
          <RemoteStatusButton
            anchorRef={remoteAnchorRef}
            open={Boolean(remoteMenuOpen)}
            online={remoteOnline ?? null}
            stage={remoteStage}
            reachable={Boolean(remoteReachable)}
            onPress={onToggleRemoteMenu}
          />
        ) : null}
        <View ref={bellRef} collapsable={false} style={styles.notificationButtonWrap}>
          <SeasonalIcon>
            <Press
              onPress={onOpenNotifications}
              sound="navigate"
              focusVariant="quiet"
              accessibilityLabel={totalNotifications > 0 ? `Thông báo, ${totalNotifications} thông báo` : 'Thông báo'}
              style={[
                styles.glassCircleButton,
                {
                  width: s(32),
                  height: s(32),
                  borderRadius: s(16),
                  borderColor: MENU_GLASS.border,
                  backgroundColor: 'transparent',
                },
              ]}
            >
              <MenuGlassBackdrop variant="control" radius={s(16)} />
              {downloadPercent !== null ? <ProgressRing size={s(32)} percent={downloadPercent} color={CONSOLE.controllerA} /> : null}
              <Bell
                size={s(16)}
                color={totalNotifications > 0 ? colors.white : 'rgba(255,255,255,0.72)'}
                strokeWidth={1.8}
              />
            </Press>
          </SeasonalIcon>
          {totalNotifications > 0 ? (
            <View
              pointerEvents="none"
              style={[
                styles.notificationBadge,
                {
                  top: -s(3),
                  right: -s(4),
                  minWidth: s(14),
                  height: s(14),
                  borderRadius: s(7),
                  paddingHorizontal: s(3),
                },
              ]}
            >
              <T size={8} weight="bold" color={colors.white} tabular>
                {totalNotifications > 99 ? '99+' : totalNotifications}
              </T>
            </View>
          ) : null}
        </View>
        <SeasonalIcon>
          <Press
            onPress={() => onOpenSettings('quality')}
            accessibilityLabel="Cài đặt"
            focusVariant="quiet"
            style={[styles.glassCircleButton, { width: s(32), height: s(32), borderRadius: s(16) }]}
          >
            <MenuGlassBackdrop variant="control" radius={s(16)} />
            <Settings size={s(16)} color="rgba(255,255,255,0.72)" strokeWidth={1.8} />
          </Press>
        </SeasonalIcon>
        <View style={{ width: StyleSheet.hairlineWidth, height: s(20), backgroundColor: glass.controlActive }} />
        <SteamAccountButton profile={steamProfile} onPress={onOpenProfile} onLongPress={onOpenControlCenter} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MENU_GLASS.border,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  tabBarCapsule: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: MENU_GLASS.border,
  },
  tabIndicator: {
    backgroundColor: CONSOLE.navigationSelected,
    borderWidth: 1,
    borderColor: CONSOLE.navigationSelectedBorder,
  },
  devices: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  deviceIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    backgroundColor: CONSOLE.action,
  },
  notificationButtonWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  notificationBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.panelSolid, 0.9),
    backgroundColor: CONSOLE.action,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 1.5,
    borderColor: CONSOLE.border,
    backgroundColor: CONSOLE.control,
  },
  presence: { position: 'absolute', right: 0, bottom: 0, borderWidth: 1, borderColor: colors.card },
  remoteButtonWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  remoteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.bg,
    zIndex: 2,
  },
  glassCircleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MENU_GLASS.border,
    backgroundColor: 'transparent',
  },
}));
