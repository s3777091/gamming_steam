import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Bell, Gamepad2, Monitor, MonitorSmartphone, Settings } from 'lucide-react-native';

import { batteryColor, lowestControllerBattery } from '@/features/devices/battery';
import { DEVICE_KIND_ORDER, type LocalDevice } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { formatClock } from '@/features/library/format';
import type { SteamProfile, StoreTab } from '@/features/library/types';
import { colors, glass } from '@/theme';
import { Img } from '@/ui/Img';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ProgressRing } from './DownloadViews';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';

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
  const { s } = useUi();
  const [anim] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [anim, open]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => DEVICE_KIND_ORDER.indexOf(a.kind) - DEVICE_KIND_ORDER.indexOf(b.kind));
  }, [devices]);

  const controllerBattery = useMemo(() => lowestControllerBattery(devices), [devices]);
  const displayDevices = useMemo(() => sortedDevices.slice(0, 4), [sortedDevices]);
  const overflowCount = sortedDevices.length > 4 ? sortedDevices.length - 4 : 0;
  const N = displayDevices.length;
  const hasBattery = controllerBattery !== null;

  const ICON_WRAP = s(22);
  const ICON_SIZE = s(14.5);
  const SEPARATED_GAP = s(6);
  const OVERLAP_OFFSET = s(13); // Khoảng cách giữa các icon khi đè lên nhau (overlap 9dp)
  const SHIFT_DELTA = (ICON_WRAP + SEPARATED_GAP) - OVERLAP_OFFSET; // 15dp
  const PADDING_H = s(9);
  const batteryWidth = hasBattery ? s(28) : 0;
  const overflowWidth = overflowCount > 0 ? s(16) : 0;

  // Tính độ rộng theo số lượng icon và thiết bị
  let collapsedContentWidth = ICON_WRAP;
  let separatedContentWidth = ICON_WRAP;

  if (N >= 2) {
    collapsedContentWidth = ICON_WRAP + (N - 1) * OVERLAP_OFFSET + batteryWidth + overflowWidth;
    separatedContentWidth = ICON_WRAP + (N - 1) * (ICON_WRAP + SEPARATED_GAP) + batteryWidth + overflowWidth;
  } else if (N === 1) {
    collapsedContentWidth = ICON_WRAP + batteryWidth;
    separatedContentWidth = ICON_WRAP + batteryWidth;
  }

  const collapsedTotalWidth = collapsedContentWidth + PADDING_H * 2;
  const separatedTotalWidth = separatedContentWidth + PADDING_H * 2;

  const animatedWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedTotalWidth, separatedTotalWidth],
  });

  const pillBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.08)', 'rgba(102, 168, 255, 0.22)'],
  });

  const pillBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.16)', colors.accent],
  });

  const accessibilityLabel = controllerBattery !== null
    ? `Thiết bị đang kết nối, pin tay cầm ${controllerBattery}%`
    : (N > 0 ? `Thiết bị đang kết nối: ${N} thiết bị` : 'Thiết bị đang kết nối');

  return (
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
      <GlassBackdrop material="control" intensity={40} radius={s(16)} />
      <Press
        onPress={onPress}
        sound="confirm"
        accessibilityLabel={accessibilityLabel}
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
                        outputRange: ['rgba(18, 22, 30, 0.95)', 'rgba(0, 0, 0, 0)'],
                      }),
                      borderWidth: i === 0 ? 0 : 1.5,
                      borderColor: i === 0 ? 'transparent' : anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['rgba(28, 34, 46, 0.9)', 'rgba(0, 0, 0, 0)'],
                      }),
                    },
                  ]}
                >
                  <Icon size={ICON_SIZE} color={open ? colors.accent : colors.text} strokeWidth={1.8} />
                </Animated.View>
              );
            })}

            {hasBattery ? (
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
                <T size={10.5} weight="bold" color={batteryColor(controllerBattery)} tabular>
                  {controllerBattery}%
                </T>
              </Animated.View>
            ) : null}

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
                <T size={9.6} weight="bold" color={colors.accentSoft} tabular>
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
      </Press>
    </Animated.View>
  );
}

/** Nút hiển thị trạng thái kết nối giữa thiết bị remote và PC; bấm để mở menu điều khiển. */
function RemoteStatusButton({
  open,
  online,
  stage,
  reachable,
  onPress,
}: {
  open: boolean;
  online: boolean | null;
  stage?: string;
  reachable: boolean;
  onPress: () => void;
}) {
  const { s } = useUi();
  const isOnline = reachable || online === true;
  const isConnecting = stage === 'network' || stage === 'signal_sent' || (online === null && !reachable);
  const statusColor = isOnline ? colors.success : isConnecting ? colors.warning : colors.text4;

  return (
    <Press
      onPress={onPress}
      sound="confirm"
      accessibilityLabel={`Kết nối PC: ${isOnline ? 'Đã kết nối' : isConnecting ? 'Đang kết nối' : 'Ngoại tuyến'}`}
      style={[
        styles.remoteButton,
        {
          width: s(32),
          height: s(32),
          borderRadius: s(16),
          backgroundColor: open ? 'rgba(102,168,255,0.24)' : 'rgba(255,255,255,0.08)',
          borderColor: open ? colors.accent : 'rgba(255,255,255,0.18)',
        },
      ]}
    >
      <GlassBackdrop material="control" intensity={40} radius={s(16)} />
      <Monitor
        size={s(15)}
        color={open ? colors.accent : isOnline ? colors.white : 'rgba(255,255,255,0.72)'}
        strokeWidth={1.8}
      />
      <View
        style={[
          styles.statusDot,
          {
            width: s(7),
            height: s(7),
            borderRadius: s(3.5),
            backgroundColor: statusColor,
            top: s(2),
            right: s(2),
          },
        ]}
      />
    </Press>
  );
}

function SteamAccountButton({ profile, onPress }: { profile: SteamProfile | null; onPress: () => void }) {
  const { s } = useUi();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={profile?.personaName ? `Hồ sơ ${profile.personaName}` : 'Xem hồ sơ'}
      style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={[styles.avatar, { width: s(32), height: s(32), borderRadius: s(16) }]}>
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
    </Press>
  );
}

function HeaderClock() {
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
      <GlassBackdrop material="control" intensity={40} radius={s(16)} />
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
  const { s } = useUi();
  const [anim] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: TAB_MOTION_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
    }).start();
  }, [active, anim]);

  return (
    <Press
      focusable={false}
      sound="navigate"
      pressScale={0.96}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        width: tabWidth,
        height: s(30),
        borderRadius: s(15),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
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
        <T size={12} weight="bold" color={colors.white}>{tab.label}</T>
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
  const { s } = useUi();
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
      Animated.timing(indicatorX, {
        toValue: targetX,
        duration: TAB_MOTION_MS,
        easing: TAB_MOTION_EASING,
        useNativeDriver: true,
      }).start();
    }
  }, [indicatorX, tabIndex, targetX]);

  return (
    <View
      style={[
        styles.tabBarCapsule,
        {
          flexDirection: 'row',
          height: s(36),
          borderRadius: s(18),
          alignItems: 'center',
          position: 'relative',
          paddingHorizontal: s(3),
          overflow: 'hidden',
        },
      ]}
      accessibilityRole="tablist"
    >
      <GlassBackdrop material="control" intensity={46} radius={s(18)} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIndicator,
          {
            position: 'absolute',
            top: s(3),
            bottom: s(3),
            left: s(3),
            borderRadius: s(15),
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
  const { s } = useUi();
  const totalNotifications = notificationCount !== undefined
    ? notificationCount
    : (unreadCount + downloadCount);

  return (
    <View style={[styles.header, { height: s(48) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(18) }}>
        <HeaderClock />
        <ConsoleTabs activeTab={activeTab} onTabChange={onTabChange} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), height: s(32) }}>
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
          <View ref={remoteAnchorRef} collapsable={false}>
            <RemoteStatusButton
              open={Boolean(remoteMenuOpen)}
              online={remoteOnline ?? null}
              stage={remoteStage}
              reachable={Boolean(remoteReachable)}
              onPress={onToggleRemoteMenu}
            />
          </View>
        ) : null}
        <View ref={bellRef} collapsable={false} style={styles.notificationButtonWrap}>
          <Press
            onPress={onOpenNotifications}
            sound="navigate"
            accessibilityLabel={totalNotifications > 0 ? `Thông báo, ${totalNotifications} thông báo` : 'Thông báo'}
            style={[
              styles.glassCircleButton,
              {
                width: s(32),
                height: s(32),
                borderRadius: s(16),
                borderColor: totalNotifications > 0 ? 'rgba(102,168,255,0.4)' : 'rgba(255,255,255,0.16)',
                backgroundColor: totalNotifications > 0 ? 'rgba(102,168,255,0.14)' : 'rgba(255,255,255,0.08)',
              },
            ]}
          >
            <GlassBackdrop material="control" intensity={40} radius={s(16)} />
            {downloadPercent !== null ? <ProgressRing size={s(32)} percent={downloadPercent} color={colors.accent} /> : null}
            <Bell
              size={s(16)}
              color={totalNotifications > 0 ? colors.white : 'rgba(255,255,255,0.72)'}
              strokeWidth={1.8}
            />
          </Press>
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
        <Press
          onPress={() => onOpenSettings('quality')}
          accessibilityLabel="Cài đặt"
          style={[styles.glassCircleButton, { width: s(32), height: s(32), borderRadius: s(16) }]}
        >
          <GlassBackdrop material="control" intensity={40} radius={s(16)} />
          <Settings size={s(16)} color="rgba(255,255,255,0.72)" strokeWidth={1.8} />
        </Press>
        <View style={{ width: StyleSheet.hairlineWidth, height: s(20), backgroundColor: 'rgba(255,255,255,0.16)' }} />
        <SteamAccountButton profile={steamProfile} onPress={onOpenProfile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 },
  clockBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: glass.control,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  tabBarCapsule: {
    backgroundColor: glass.control,
    borderWidth: 1,
    borderColor: glass.controlBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  tabIndicator: {
    backgroundColor: glass.controlActive,
    borderWidth: 1,
    borderColor: glass.controlBorderActive,
    shadowColor: '#ffffff',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  devices: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
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
    backgroundColor: colors.primary,
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
    borderColor: 'rgba(7, 16, 28, 0.9)',
    backgroundColor: colors.primary,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  presence: { position: 'absolute', right: 0, bottom: 0, borderWidth: 1, borderColor: '#111821' },
  remoteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: '#080c12',
  },
  glassCircleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: glass.control,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
});
