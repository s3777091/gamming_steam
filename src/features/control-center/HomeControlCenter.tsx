// Control Center ở màn chính (giữ Start + Select). Cùng dáng với menu Guide
// trong stream: kính mờ, đồng hồ góc phải, dock ở đáy, popover kiểu Apple.
//
// Ô game nằm đúng chỗ của Tab game cũ: game vẫn chạy trên PC sau khi bấm Home
// trong stream hiện logo ở đây; bấm vào là nối lại stream và vào thẳng game đó.

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { Bell, Gamepad2, Home, Play, Power, UserRound, X, type LucideIcon } from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import type { LocalDevice } from '@/features/devices/useInputDevices';
import type { AppNotification } from '@/features/library/types';
import { PC_ROUTES, pcPostJson } from '@/lib/pc-api';
import { forgetStreamGame, type ResumableGame } from '@/lib/stream-resume';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { DevicesPanel, NotificationsPanel, ProfilePanel, UserAvatar } from './ControlCenterPanels';
import { ControlPopover, type PopoverAnchor } from './ControlPopover';

type PopoverId = 'notifications' | 'devices' | 'profile';

type DockItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  popover?: PopoverId;
  badge?: number | string | null;
  danger?: boolean;
  run?: () => void;
};

function formatClock(date: Date): string {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;
}

export function HomeControlCenter({
  open,
  game,
  profile,
  devices,
  notifications,
  unreadCount,
  onMarkAllRead,
  onResume,
  onClose,
}: {
  open: boolean;
  game: ResumableGame | null;
  profile: { name: string; avatarUrl: string | null; email: string | null };
  devices: LocalDevice[];
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  /** Nối lại stream vào game đang chạy trên PC. */
  onResume: (game: ResumableGame) => void;
  onClose: () => void;
}) {
  const { s, insets } = useUi();
  const { reduceMotion } = useMotion();
  const [mounted, setMounted] = useState(open);
  const [fade] = useState(() => new Animated.Value(0));
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [popover, setPopover] = useState<{ id: PopoverId; anchor: PopoverAnchor | null } | null>(null);
  const [popoverShown, setPopoverShown] = useState<PopoverId | null>(null);
  const [dockNodes] = useState(() => new Map<string, View>());
  const [quitting, setQuitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    const animation = Animated.timing(fade, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : open ? 220 : 160,
      easing: open ? Easing.bezier(0.16, 1, 0.3, 1) : Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !open) {
        setMounted(false);
        setPopover(null);
      }
    });
    return () => animation.stop();
  }, [fade, mounted, open, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setClock(formatClock(new Date())), 10_000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2_600);
    return () => clearTimeout(timer);
  }, [message]);

  useBack(() => {
    if (popover) setPopover(null);
    else onClose();
  }, open);

  const openPopover = useCallback((id: PopoverId) => {
    if (popover?.id === id) {
      setPopover(null);
      return;
    }
    setPopoverShown(id);
    const node = dockNodes.get(id);
    if (!node) {
      setPopover({ id, anchor: null });
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      setPopover({ id, anchor: w > 0 && h > 0 ? { x, y, width: w, height: h } : null });
    });
  }, [dockNodes, popover?.id]);

  const quitGame = useCallback(() => {
    if (!game || quitting) return;
    setQuitting(true);
    void pcPostJson(PC_ROUTES.gameRuntime, { action: 'quit', gameId: game.gameId }, 'Không đóng được game trên máy tính.')
      .then(() => {
        forgetStreamGame(game.gameId);
        setMessage(`Đã đóng ${game.title}.`);
      })
      .catch((error: Error) => setMessage(error.message || 'Không đóng được game trên máy tính.'))
      .finally(() => setQuitting(false));
  }, [game, quitting]);

  if (!mounted) return null;

  const items: DockItem[] = [
    { id: 'home', label: 'Home', icon: Home, run: onClose },
    ...(game ? [{ id: 'game', label: `Tiếp tục ${game.title}`, icon: Gamepad2, run: () => onResume(game) }] : []),
    {
      id: 'notifications',
      label: 'Thông báo',
      icon: Bell,
      popover: 'notifications' as const,
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null,
    },
    { id: 'devices', label: 'Thiết bị', icon: Gamepad2, popover: 'devices' as const, badge: devices.length > 0 ? devices.length : null },
    { id: 'profile', label: profile.name, icon: UserRound, popover: 'profile' as const },
    ...(game ? [{ id: 'exit', label: 'Thoát game', icon: Power, danger: true, run: quitGame }] : []),
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={open ? 'auto' : 'none'} accessibilityViewIsModal>
      <FocusLayer>
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(5,7,12,0.82)', 'rgba(5,7,12,0.3)', 'rgba(5,7,12,0.9)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.topBar, { top: insets.top + s(10), right: insets.right + s(24), gap: s(6) }]}>
          <Press
            onPress={onClose}
            sound="back"
            accessibilityLabel="Đóng Control Center"
            style={[styles.closeBtn, { width: s(32), height: s(32), borderRadius: s(16) }]}
          >
            <X size={s(15)} color="rgba(255,255,255,0.65)" />
          </Press>
        </View>

        {/* Thẻ game đang chạy trên PC (hoặc lời nhắc khi không có game nào) */}
        <View style={[styles.center, { paddingBottom: s(90) + insets.bottom }]} pointerEvents="box-none">
          {game ? (
            <Press
              onPress={() => onResume(game)}
              pressScale={0.98}
              accessibilityLabel={`Tiếp tục ${game.title}`}
              style={[styles.gameCard, { width: s(360), height: s(176), borderRadius: s(22) }]}
            >
              {game.heroUrl ? <Img source={{ uri: game.heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <LinearGradient
                colors={['rgba(9,11,18,0.15)', 'rgba(9,11,18,0.92)']}
                locations={[0.25, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.cardTag, { top: s(12), left: s(12), paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(8), gap: s(5) }]}>
                <View style={[styles.greenDot, { width: s(6), height: s(6), borderRadius: s(3) }]} />
                <T size={9.5} weight="bold" color="#4ade80">ĐANG CHẠY TRÊN PC</T>
              </View>
              <View style={{ position: 'absolute', left: s(14), right: s(14), bottom: s(12) }}>
                {game.logoUrl ? (
                  <Img source={{ uri: game.logoUrl }} style={{ width: s(180), height: s(44) }} contentFit="contain" contentPosition="left" />
                ) : (
                  <T size={16} weight="bold" color="#ffffff" numberOfLines={1}>{game.title}</T>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(6) }}>
                  <Play size={s(11)} color="#c7d2fe" fill="#c7d2fe" />
                  <T size={10.5} weight="semibold" color="#c7d2fe">Chạm để quay lại game</T>
                </View>
              </View>
            </Press>
          ) : (
            <View style={{ alignItems: 'center', gap: s(6) }}>
              <Gamepad2 size={s(26)} color="rgba(255,255,255,0.35)" />
              <T size={12} color="rgba(255,255,255,0.55)">Không có game nào đang chạy trên máy tính</T>
            </View>
          )}
        </View>

        {/* Dock */}
        <View style={[styles.dockWrapper, { bottom: s(12) + insets.bottom }]}>
          <View style={[styles.dockBar, { borderRadius: s(22), padding: s(5), gap: s(4) }]}>
            <BlurView intensity={65} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: s(22), overflow: 'hidden' }]} />
            {items.map((item, index) => {
              const Icon = item.icon;
              const popoverOpen = Boolean(item.popover && popover?.id === item.popover);
              const hasBadge = item.badge !== null && item.badge !== undefined;
              return (
                <View
                  key={item.id}
                  collapsable={false}
                  ref={(node) => {
                    if (node) dockNodes.set(item.id, node);
                    else dockNodes.delete(item.id);
                  }}
                >
                <Press
                  autoFocus={index === (game ? 1 : 0)}
                  onPress={() => {
                    if (item.popover) openPopover(item.popover);
                    else {
                      setPopover(null);
                      item.run?.();
                    }
                  }}
                  pressScale={0.92}
                  accessibilityLabel={item.label}
                  style={[
                    styles.dockBtn,
                    {
                      width: s(42),
                      height: s(42),
                      borderRadius: s(14),
                      backgroundColor: popoverOpen ? 'rgba(255,255,255,0.18)' : 'transparent',
                    },
                  ]}
                >
                  {item.id === 'game' && game ? (
                    <View style={[styles.gameTile, { width: s(30), height: s(30), borderRadius: s(9) }]}>
                      {game.heroUrl ? <Img source={{ uri: game.heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon size={s(16)} color="#ffffff" />}
                    </View>
                  ) : item.id === 'profile' ? (
                    <UserAvatar uri={profile.avatarUrl} name={profile.name} size={s(popoverOpen ? 28 : 26)} ring={popoverOpen} />
                  ) : item.id === 'exit' && quitting ? (
                    <ActivityIndicator size="small" color="#f87171" />
                  ) : (
                    <Icon size={s(19)} color={item.danger ? '#f87171' : popoverOpen ? '#ffffff' : 'rgba(255,255,255,0.7)'} />
                  )}
                  {hasBadge ? (
                    <View style={styles.badge}>
                      <T size={8.5} weight="bold" color="#ffffff" tabular>{item.badge}</T>
                    </View>
                  ) : item.id === 'game' ? (
                    <View style={styles.liveDot} />
                  ) : null}
                </Press>
                </View>
              );
            })}
            <View style={[styles.divider, { height: s(22), marginHorizontal: s(8) }]} />
            <T size={13} weight="semibold" color="rgba(255,255,255,0.9)" tabular style={{ marginRight: s(8) }}>{clock}</T>
          </View>
        </View>

        {message ? (
          <View pointerEvents="none" style={[styles.toast, { bottom: s(86) + insets.bottom, paddingHorizontal: s(16), paddingVertical: s(7), borderRadius: s(16) }]}>
            <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
            <T size={11.5} weight="medium" color="rgba(255,255,255,0.88)">{message}</T>
          </View>
        ) : null}

        <ControlPopover
          open={popover !== null}
          anchor={popover?.anchor ?? null}
          title={popoverShown === 'devices' ? 'Thiết bị' : popoverShown === 'profile' ? 'Tài khoản' : 'Thông báo'}
          icon={popoverShown === 'devices' ? Gamepad2 : popoverShown === 'profile' ? UserRound : Bell}
          accent={popoverShown === 'notifications' ? '#ff9f0a' : popoverShown === 'devices' ? '#34c759' : '#bf5af2'}
          width={popoverShown === 'notifications' ? 360 : 320}
          action={popoverShown === 'notifications' && unreadCount > 0 ? (
            <Press onPress={onMarkAllRead} hitSlop={8}>
              <T size={10} weight="semibold" color="#64a8ff">Đánh dấu đã đọc</T>
            </Press>
          ) : null}
          onClose={() => setPopover(null)}
        >
          {popoverShown === 'devices' ? (
            <DevicesPanel devices={devices} />
          ) : popoverShown === 'profile' ? (
            <ProfilePanel
              name={profile.name}
              email={profile.email}
              avatarUrl={profile.avatarUrl}
              status={game ? `Đang chạy ${game.title} trên PC` : 'Đã đăng nhập'}
            />
          ) : (
            <NotificationsPanel notifications={notifications} />
          )}
        </ControlPopover>
      </FocusLayer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 300, elevation: 300, backgroundColor: 'rgba(4,6,10,0.6)' },
  topBar: { position: 'absolute', alignItems: 'flex-end', zIndex: 20 },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gameCard: {
    overflow: 'hidden',
    backgroundColor: '#141722',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  cardTag: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  greenDot: { backgroundColor: '#4ade80' },
  dockWrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,22,30,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dockBtn: { alignItems: 'center', justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)' },
  gameTile: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderWidth: 1.2,
    borderColor: '#0b0d14',
  },
  liveDot: {
    position: 'absolute',
    bottom: 1,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4ade80',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
