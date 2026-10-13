import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Bell, Gamepad2, Monitor, MonitorSmartphone, Settings } from 'lucide-react-native';

import { DEVICE_KIND_ORDER, useInputDevices, type DeviceKind } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { formatClock } from '@/features/library/format';
import type { SteamProfile, StoreTab } from '@/features/library/types';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ProgressRing } from './DownloadViews';

const TABS: { id: StoreTab; label: string }[] = [
  { id: 'games', label: 'Games' },
  { id: 'store', label: 'Store' },
  { id: 'pc', label: 'PC' },
];

// Ước lượng vị trí/độ rộng vạch chỉ tab trước khi đo layout (cùng đơn vị s()).
const TAB_ESTIMATE: Record<StoreTab, { x: number; w: number }> = {
  games: { x: 14, w: 44 },
  store: { x: 94, w: 38 },
  pc: { x: 168, w: 20 },
};

/** Cụm icon thiết bị đang nối (tay cầm, tai nghe, bàn phím, chuột); chạm để mở Cài đặt > Thiết bị. */
function DeviceStatusButton({ onPress }: { onPress: () => void }) {
  const { s } = useUi();
  const { devices } = useInputDevices();
  const groups = useMemo(() => {
    const byKind = new Map<DeviceKind, number>();
    for (const device of devices) byKind.set(device.kind, (byKind.get(device.kind) ?? 0) + 1);
    return DEVICE_KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({ kind, count: byKind.get(kind)! }));
  }, [devices]);

  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Thiết bị đang kết nối"
      style={[styles.devices, { height: s(32), borderRadius: s(16), paddingHorizontal: s(10), gap: s(4) }]}
    >
      {groups.length ? groups.slice(0, 4).map(({ kind, count }) => {
        const Icon = KIND_ICONS[kind];
        return (
          <View key={kind} style={{ width: s(24), height: s(24), alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={s(15)} color={colors.text2} strokeWidth={1.8} />
            {count > 1 ? (
              <View style={[styles.count, { minWidth: s(14), height: s(14), borderRadius: s(7), top: -s(1), right: -s(2) }]}>
                <T size={8} weight="semibold" tabular>{count}</T>
              </View>
            ) : null}
          </View>
        );
      }) : (
        <View style={{ width: s(24), height: s(24), alignItems: 'center', justifyContent: 'center' }}>
          <MonitorSmartphone size={s(15)} color={colors.text4} strokeWidth={1.8} />
        </View>
      )}
      {groups.length > 4 ? <T size={9.6} weight="semibold" color={colors.text3} tabular>+{groups.length - 4}</T> : null}
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
          backgroundColor: open ? 'rgba(102,168,255,0.22)' : 'rgba(255,255,255,0.07)',
          borderColor: open ? colors.accent : 'rgba(255,255,255,0.14)',
        },
      ]}
    >
      <Monitor
        size={s(15)}
        color={open ? colors.accent : isOnline ? colors.white : 'rgba(255,255,255,0.66)'}
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
          <Gamepad2 size={s(16)} color="rgba(255,255,255,0.62)" strokeWidth={1.7} />
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
    // Một timeout bắn đúng đầu phút kế tiếp, không phải đồng hồ chạy 30 giây một lần.
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
    <View style={{ height: s(32), justifyContent: 'center' }}>
      <T size={13.2} weight="semibold" color="rgba(255,255,255,0.92)" tabular>{clock}</T>
    </View>
  );
}

function ConsoleTabItem({
  tab,
  active,
  onPress,
  onLayout,
}: {
  tab: { id: StoreTab; label: string };
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { s } = useUi();
  const [anim] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, anim]);

  return (
    <Press
      sound="navigate"
      pressScale={0.97}
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{ height: s(34), paddingHorizontal: s(14), borderRadius: s(17), alignSelf: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.48, 1],
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
        <T size={12.2} weight="semibold" color={colors.white}>{tab.label}</T>
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
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const initialEstimate = TAB_ESTIMATE[activeTab];

  const [indicatorX] = useState(() => new Animated.Value(s(initialEstimate.x)));
  const [indicatorW] = useState(() => new Animated.Value(s(initialEstimate.w)));
  const hasMounted = useRef(false);

  useEffect(() => {
    const layout = tabLayouts[activeTab];
    const estimate = TAB_ESTIMATE[activeTab];
    const targetX = layout ? layout.x + s(14) : s(estimate.x);
    const targetW = layout ? Math.max(s(16), layout.width - s(28)) : s(estimate.w);

    if (!hasMounted.current) {
      if (layout) hasMounted.current = true;
      indicatorX.setValue(targetX);
      indicatorW.setValue(targetW);
      return;
    }

    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: targetX,
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: false,
      }),
      Animated.spring(indicatorW, {
        toValue: targetW,
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: false,
      }),
    ]).start();
  }, [activeTab, tabLayouts, s, indicatorX, indicatorW]);

  const handleLayout = (id: StoreTab, layout: { x: number; width: number }) => {
    setTabLayouts((prev) => {
      const existing = prev[id];
      if (existing && Math.abs(existing.x - layout.x) < 1 && Math.abs(existing.width - layout.width) < 1) {
        return prev;
      }
      return { ...prev, [id]: layout };
    });
  };

  return (
    <View style={{ flexDirection: 'row', height: s(48), gap: s(8), alignItems: 'center', position: 'relative' }} accessibilityRole="tablist">
      {TABS.map((tab) => (
        <ConsoleTabItem
          key={tab.id}
          tab={tab}
          active={activeTab === tab.id}
          onPress={() => onTabChange(tab.id)}
          onLayout={(e) => handleLayout(tab.id, e.nativeEvent.layout)}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIndicator,
          {
            position: 'absolute',
            bottom: s(9),
            left: 0,
            height: s(2.5),
            borderRadius: s(1.25),
            width: indicatorW,
            transform: [{ translateX: indicatorX }],
          },
        ]}
      />
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
        <DeviceStatusButton onPress={() => onOpenSettings('devices')} />
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
        <View ref={bellRef} collapsable={false}>
          <Press
            onPress={onOpenNotifications}
            sound="navigate"
            accessibilityLabel={totalNotifications > 0 ? `Thông báo, ${totalNotifications} thông báo` : 'Thông báo'}
            style={{ minWidth: s(32), height: s(32), paddingHorizontal: s(4), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
          >
            {downloadPercent !== null ? <ProgressRing size={s(32)} percent={downloadPercent} color={colors.accent} /> : null}
            <View style={{ position: 'relative', width: s(18), height: s(18), alignItems: 'center', justifyContent: 'center' }}>
              <Bell
                size={s(17)}
                color={totalNotifications > 0 ? colors.white : 'rgba(255,255,255,0.66)'}
                strokeWidth={1.8}
              />
              {totalNotifications > 0 ? (
                <View style={[styles.cornerNumber, { top: -s(5), left: s(13) }]} pointerEvents="none">
                  <T size={9.5} weight="bold" color={colors.white} tabular>
                    {totalNotifications}
                  </T>
                </View>
              ) : null}
            </View>
          </Press>
        </View>
        <Press
          onPress={() => onOpenSettings('quality')}
          accessibilityLabel="Cài đặt"
          style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={s(16)} color="rgba(255,255,255,0.66)" strokeWidth={1.8} />
        </Press>
        <View style={{ width: StyleSheet.hairlineWidth, height: s(20), backgroundColor: 'rgba(255,255,255,0.16)' }} />
        <SteamAccountButton profile={steamProfile} onPress={onOpenProfile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 },
  tabIndicator: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  devices: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  count: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    backgroundColor: colors.primary,
  },
  cornerNumber: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  presence: { position: 'absolute', right: 0, bottom: 0, borderWidth: 1, borderColor: '#111821' },
  remoteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: '#080c12',
  },
});
