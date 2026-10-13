import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell, Gamepad2, Monitor, MonitorSmartphone, Settings } from 'lucide-react-native';

import { DEVICE_KIND_ORDER, useInputDevices, type DeviceKind } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { formatClock, steamPresence } from '@/features/library/format';
import type { SteamProfile, StoreTab } from '@/features/library/types';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ProgressRing } from './DownloadViews';

const LOGO = require('../../../assets/jetsona-logo.png');

const TABS: Array<{ id: StoreTab; label: string }> = [
  { id: 'games', label: 'Games' },
  { id: 'store', label: 'Store' },
];

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

function SteamAccountButton({ profile, onPress, showName }: { profile: SteamProfile | null; onPress: () => void; showName: boolean }) {
  const { s } = useUi();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Xem hồ sơ Steam"
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), height: s(32), maxWidth: s(230) }}
    >
      {showName ? (
        <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
          <T size={11.5} weight="semibold" numberOfLines={1}>{profile?.personaName || 'Tài khoản Steam'}</T>
          <T size={9} color={colors.text3} numberOfLines={1}>{steamPresence(profile)}</T>
        </View>
      ) : null}
      <View style={[styles.avatar, { width: s(32), height: s(32), borderRadius: s(16) }]}>
        {profile?.avatarUrl ? (
          <Img source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
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
  return <T size={12.8} weight="medium" color="rgba(255,255,255,0.88)" tabular style={{ minWidth: s(40), textAlign: 'right' }}>{clock}</T>;
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
  downloadCount = 0,
  downloadPercent = null,
  bellRef,
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
  /** Số lượt tải Steam đang chạy: cộng vào huy hiệu trên chuông. */
  downloadCount?: number;
  /** Tiến trình lượt tải chính, vẽ thành vòng quanh chuông; null khi không có. */
  downloadPercent?: number | null;
  /** Đích của hiệu ứng thẻ game bay vào thông báo. */
  bellRef?: RefObject<View | null>;
  /** Trạng thái mở menu điều khiển remote PC. */
  remoteMenuOpen?: boolean;
  onToggleRemoteMenu?: () => void;
  remoteOnline?: boolean | null;
  remoteStage?: string;
  remoteReachable?: boolean;
}) {
  const { s, width } = useUi();
  return (
    <View style={[styles.header, { height: s(48) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(24) }}>
        <Img
          source={LOGO}
          style={{ width: s(32), height: s(32), borderRadius: s(16), borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: '#080c12' }}
          contentFit="contain"
          transition={0}
        />
        <View style={{ flexDirection: 'row', height: s(48), gap: s(8), alignItems: 'center' }} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Press
                key={tab.id}
                sound="navigate"
                pressScale={0.97}
                onPress={() => onTabChange(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{ height: s(34), paddingHorizontal: s(14), borderRadius: s(17), alignSelf: 'center', justifyContent: 'center' }}
              >
                <T size={12.2} weight="semibold" color={active ? colors.white : 'rgba(255,255,255,0.48)'}>{tab.label}</T>
                {active ? <View style={[styles.tabLine, { left: s(14), right: s(14), bottom: s(2), height: s(2), borderRadius: s(1) }]} /> : null}
              </Press>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), height: s(32) }}>
        {activeTab === 'store' ? search : null}
        <DeviceStatusButton onPress={() => onOpenSettings('devices')} />
        {onToggleRemoteMenu ? (
          <RemoteStatusButton
            open={Boolean(remoteMenuOpen)}
            online={remoteOnline ?? null}
            stage={remoteStage}
            reachable={Boolean(remoteReachable)}
            onPress={onToggleRemoteMenu}
          />
        ) : null}
        <View ref={bellRef} collapsable={false}>
          <Press
            onPress={onOpenNotifications}
            sound="navigate"
            accessibilityLabel={downloadCount > 0 ? `Thông báo, ${downloadCount} lượt tải đang chạy` : 'Thông báo'}
            style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' }}
          >
            {downloadPercent !== null ? <ProgressRing size={s(32)} percent={downloadPercent} color={colors.accent} /> : null}
            <Bell size={s(16)} color={downloadCount > 0 ? colors.white : 'rgba(255,255,255,0.66)'} strokeWidth={1.8} />
            {unreadCount + downloadCount > 0 ? (
              <View style={[styles.badge, { minWidth: s(14), height: s(14), borderRadius: s(7), top: -s(1), right: -s(2) }]}>
                <T size={8} weight="semibold" tabular>{unreadCount + downloadCount > 9 ? '9+' : unreadCount + downloadCount}</T>
              </View>
            ) : null}
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
        <SteamAccountButton profile={steamProfile} onPress={onOpenProfile} showName={width >= 760} />
        <HeaderClock />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 },
  tabLine: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.accent },
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
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    backgroundColor: colors.primary,
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
