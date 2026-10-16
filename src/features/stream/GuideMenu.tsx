// Menu Guide (PS5 Control Center style): mở bằng Alt hoặc Start + Select.
// Thiết kế tinh gọn, trực quan, không tạo noise.
//
// Góc trên phải: nút đóng. Thanh dock dưới: các nút chức năng + đồng hồ; Thông báo,
// Thiết bị và Tài khoản bung popover kiểu Apple ngay trên nút.
//
// Tay cầm điều khiển menu này bằng D-pad / A / B, cảm ứng / chuột dùng trực tiếp.

import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Bell,
  Camera,
  Copy,
  Gamepad2,
  Home,
  LogOut,
  Power,
  Radio,
  RotateCw,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { addListener, exportFrame, releaseFrame } from 'jetsona-input';

import { useInputDevices } from '@/features/devices/useInputDevices';
import { useNotifications } from '@/features/library/useNotifications';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { ControlPopover, type PopoverAnchor } from '@/features/control-center/ControlPopover';
import { DevicesPanel, NotificationsPanel, ProfilePanel, UserAvatar } from '@/features/control-center/ControlCenterPanels';
import type { PendingGameLaunch } from '@/lib/game-launch';
import type { StreamSettings } from '@/lib/stream-settings';
import { uploadGameScreenshot } from '@/lib/game-screenshots';
import { PC_ROUTES, pcFetch } from '@/lib/pc-api';
import { rememberStreamGame } from '@/lib/stream-resume';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { alpha, glassShadow, glassShadowSubtle, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import type { BorderOrigin as StreamBorderOrigin } from './StreamLiveBorder';
import type { WatchPartyState } from './useWatchPartyHost';

export type RunningGame = {
  id: string;
  title: string;
  source: string;
  artworkUrl: string | null;
  heroUrl: string | null;
  active: boolean;
  paused: boolean;
  processCount: number;
};

type PopoverId = 'notifications' | 'devices' | 'profile';

/** Game sắp thoát, để màn stream diễn hoạt cảnh thoát bằng đúng artwork của nó. */
export type ExitingGame = { gameId: string | null; title: string; heroUrl: string | null; logoUrl: string | null };

type DockAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  popover?: PopoverId;
  badge?: number | string | null;
  dot?: boolean;
  run?: () => void;
};

function formatClock(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minStr} ${ampm}`;
}

export function GuideMenu({
  open,
  profile,
  hasFrame,
  status,
  watchParty,
  launch,
  videoSize,
  streamSettings,
  notificationCount: notificationCountProp,
  onClose,
  onHome,
  onReload,
  onExitGame,
  onStreamOrigin,
}: {
  open: boolean;
  profile: { name: string; avatarUrl: string | null; email?: string | null } | null;
  /** Đã giữ được một khung hình để chụp (grabFrame lúc mở menu). */
  hasFrame: boolean;
  status?: string | null;
  watchParty: WatchPartyState;
  launch?: PendingGameLaunch | null;
  videoSize?: { width: number; height: number };
  streamSettings?: StreamSettings | null;
  notificationCount?: number;
  onClose: () => void;
  onHome: () => void;
  onReload: () => void;
  /** Đã xác nhận thoát game: màn stream đóng game trên PC kèm hoạt cảnh thoát. */
  onExitGame: (game: ExitingGame) => void;
  /** Toạ độ (trong cửa sổ) của nút Streaming lúc bấm — tâm của viền xanh. */
  onStreamOrigin?: (origin: StreamBorderOrigin) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s, insets } = useUi();
  const fade = useMemo(() => new Animated.Value(0), []);
  const { devices } = useInputDevices();
  const { unreadCount, notifications, markAllAsRead } = useNotifications();

  const [games, setGames] = useState<RunningGame[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [timeStr, setTimeStr] = useState(() => formatClock(new Date()));

  // D-pad điều hướng trên dock.
  const [dockFocus, setDockFocus] = useState(0);

  const [popover, setPopover] = useState<{ id: PopoverId; anchor: PopoverAnchor | null } | null>(null);
  // Nội dung popover giữ lại trong lúc nó đang thu về, để không trống trơn khi đóng.
  const [popoverShown, setPopoverShown] = useState<PopoverId | null>(null);
  const [dockNodes] = useState(() => new Map<string, View>());

  const handleClose = useCallback(() => {
    setShot(null);
    setConfirmExit(false);
    setPopover(null);
    onClose();
  }, [onClose]);

  // Cập nhật đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(formatClock(new Date()));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Tự ẩn toast phản hồi sau 2.5s
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadGames = useCallback(async () => {
    try {
      const response = await pcFetch(PC_ROUTES.gameRuntime, { cache: 'no-store' });
      const data = await response.json().catch(() => null) as { ok?: boolean; games?: RunningGame[]; error?: string } | null;
      if (response.ok && data?.ok && Array.isArray(data.games)) {
        setGames(data.games);
      }
    } catch {
      // Giữ im lặng, không spam toast lỗi làm phiền trải nghiệm
    }
  }, []);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      void loadGames();
      Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    prevOpenRef.current = open;
    if (!open) {
      fade.setValue(0);
      releaseFrame();
    }
  }, [fade, loadGames, open]);

  const run = useCallback(async (key: string, task: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      await task();
      if (success) setToastMessage(success);
    } catch (error) {
      setToastMessage((error as Error).message || 'Tác vụ chưa hoàn thành.');
    } finally {
      setBusy(null);
    }
  }, [busy]);

  const takeScreenshot = useCallback(() => void run('shot', async () => {
    if (!hasFrame) throw new Error('Khung hình chưa sẵn sàng để chụp.');
    const base64 = await exportFrame(1920);
    if (!base64) throw new Error('Không mã hóa được ảnh chụp.');
    setShot(base64);
    const copied = await Clipboard.setImageAsync(base64).then(() => true, () => false);
    // Lưu vào D:\jetsona\storage\Images\Ảnh chụp game để xem lại trong hồ sơ.
    const title = games.find((g) => g.active)?.title || launch?.title || 'Jetsona';
    try {
      await uploadGameScreenshot(base64, title);
      setToastMessage(copied
        ? 'Đã lưu vào Ảnh chụp game và chép vào clipboard.'
        : 'Đã lưu vào Ảnh chụp game trên máy tính.');
    } catch (error) {
      const reason = (error as Error).message || 'Không lưu được ảnh lên máy tính.';
      setToastMessage(copied ? `Đã chép vào clipboard. ${reason}` : reason);
    }
  }), [games, hasFrame, launch?.title, run]);

  const toggleStreaming = useCallback(() => {
    const toggle = () => {
      if (watchParty.live) {
        watchParty.stop();
        setToastMessage('Đã dừng phát trực tiếp.');
      } else {
        void watchParty.start();
        setToastMessage('Đang khởi tạo phòng xem trực tiếp...');
      }
    };
    // Viền xanh bắn ra (và thu về) đúng nút Streaming, nên đo nút trước khi bật/tắt.
    const node = dockNodes.get('stream');
    if (!node) {
      toggle();
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) onStreamOrigin?.({ x: x + w / 2, y: y + h / 2 });
      toggle();
    });
  }, [dockNodes, onStreamOrigin, watchParty]);

  const exitGame = useCallback(() => {
    const active = games.find((g) => g.active);
    setConfirmExit(false);
    onExitGame({
      gameId: active?.id ?? launch?.gameId ?? null,
      title: active?.title || launch?.title || 'Phiên stream PC',
      heroUrl: active?.heroUrl || active?.artworkUrl || launch?.heroUrl || null,
      logoUrl: launch?.logoUrl ?? null,
    });
  }, [games, launch, onExitGame]);

  // Tính số lượng thông báo chính xác
  const totalNotifs = notificationCountProp !== undefined
    ? notificationCountProp
    : (unreadCount > 0 ? unreadCount : notifications.length);

  // Thông tin game đang hiển thị
  const activeGame = games.find((g) => g.active) ?? null;
  const gameTitle = activeGame?.title || launch?.title || 'Phiên stream PC';
  const gameArtwork = activeGame?.heroUrl || activeGame?.artworkUrl || launch?.heroUrl || launch?.logoUrl || null;

  // Dung lượng pin chính xác của tay cầm kết nối
  const controllers = useMemo(() => devices.filter((d) => d.kind === 'controller'), [devices]);
  const primaryController = controllers[0] ?? devices[0] ?? null;
  const batteryPercent = primaryController?.battery !== null && primaryController?.battery !== undefined
    ? Math.round(primaryController.battery * 100)
    : null;

  // Nhớ game đang stream để bấm Home xong vẫn quay lại được từ Control Center ở màn chính.
  const rememberedId = activeGame?.id ?? launch?.gameId ?? null;
  const rememberedHero = activeGame?.heroUrl || activeGame?.artworkUrl || launch?.heroUrl || null;
  const rememberedLogo = launch?.logoUrl ?? null;
  useEffect(() => {
    if (!rememberedId) return;
    rememberStreamGame({ gameId: rememberedId, title: gameTitle, heroUrl: rememberedHero, logoUrl: rememberedLogo });
  }, [gameTitle, rememberedHero, rememberedId, rememberedLogo]);

  // Popover kiểu Apple của các nút Thông báo / Thiết bị / Tài khoản, neo vào đúng nút.
  const openPopover = useCallback((id: PopoverId) => {
    if (popover?.id === id) {
      setPopover(null);
      return;
    }
    const node = dockNodes.get(id);
    setPopoverShown(id);
    if (!node) {
      setPopover({ id, anchor: null });
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      setPopover({ id, anchor: w > 0 && h > 0 ? { x, y, width: w, height: h } : null });
    });
  }, [dockNodes, popover?.id]);
  const closePopover = useCallback(() => setPopover(null), []);

  // Các icon chức năng chuẩn trong Dock (Đã bỏ Clipboard theo yêu cầu, thiết bị có pin chính xác)
  const dockActions: DockAction[] = useMemo(() => [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      run: () => {
        // Game vẫn chạy trên PC: ghi lại ngay lúc rời để Control Center ở màn chính hiện ô game.
        if (rememberedId) {
          rememberStreamGame({ gameId: rememberedId, title: gameTitle, heroUrl: rememberedHero, logoUrl: rememberedLogo });
        }
        onHome();
      },
    },
    {
      // Ô game (chỗ của Tab game cũ): artwork của game đang stream, bấm để quay lại chơi.
      id: 'game',
      label: `Tiếp tục ${gameTitle}`,
      icon: Gamepad2,
      dot: true,
      run: handleClose,
    },
    {
      id: 'notifications',
      label: 'Thông báo',
      icon: Bell,
      popover: 'notifications',
      badge: totalNotifs > 0 ? (totalNotifs > 99 ? '99+' : totalNotifs) : null,
    },
    {
      id: 'stream',
      label: 'Streaming',
      icon: Radio,
      run: toggleStreaming,
      dot: watchParty.live,
    },
    {
      id: 'shot',
      label: 'Chụp ảnh',
      icon: Camera,
      run: takeScreenshot,
    },
    {
      id: 'devices',
      label: batteryPercent !== null ? `Thiết bị · tay cầm ${batteryPercent}%` : 'Thiết bị',
      icon: Gamepad2,
      popover: 'devices',
      badge: devices.length > 0 ? devices.length : null,
    },
    {
      id: 'reload',
      label: 'Tải lại',
      icon: RotateCw,
      run: onReload,
    },
    {
      id: 'profile',
      label: profile?.name || 'Tài khoản',
      icon: UserRound,
      popover: 'profile',
    },
    {
      id: 'exit',
      label: 'Thoát game',
      icon: Power,
      danger: true,
      run: () => setConfirmExit(true),
    },
  ], [batteryPercent, devices.length, gameTitle, handleClose, onHome, rememberedHero, rememberedId, rememberedLogo, onReload, profile?.name, takeScreenshot, toggleStreaming, totalNotifs, watchParty.live]);

  const onSelectDockAction = useCallback((action: DockAction, index: number) => {
    setDockFocus(index);
    if (action.popover) {
      openPopover(action.popover);
      return;
    }
    setPopover(null);
    action.run?.();
  }, [openPopover]);

  // Điều khiển bằng tay cầm (D-pad & nút bấm A/B)
  const stateRef = useRef({
    dockFocus,
    dockActions,
    confirmExit,
    shot,
    popover,
    closePopover,
    onSelectDockAction,
    onClose,
    exitGame,
    toggleStreaming,
    takeScreenshot,
  });
  useEffect(() => {
    stateRef.current = {
      dockFocus,
      dockActions,
      confirmExit,
      shot,
      popover,
      closePopover,
      onSelectDockAction,
      onClose: handleClose,
      exitGame,
      toggleStreaming,
      takeScreenshot,
    };
  });

  useEffect(() => {
    if (!open) return;
    playUiSound('transition');
    return addListener('onGamepadButton', (event) => {
      if (!event.down) return;
      const current = stateRef.current;

      // Nút B: Quay lại / Đóng menu
      if (event.button === 'b') {
        playUiSound('back');
        if (current.shot) setShot(null);
        else if (current.confirmExit) setConfirmExit(false);
        else if (current.popover) current.closePopover();
        else current.onClose();
        return;
      }

      // Xác nhận thoát game
      if (current.confirmExit) {
        if (event.button === 'a') {
          playUiSound('confirm');
          current.exitGame();
        }
        return;
      }

      // D-pad trên dock
      if (event.button === 'left' || event.button === 'right') {
        playUiSound('navigate');
        const step = event.button === 'left' ? -1 : 1;
        setDockFocus(Math.min(current.dockActions.length - 1, Math.max(0, current.dockFocus + step)));
        current.closePopover();
      } else if (event.button === 'a') {
        playUiSound('select');
        const act = current.dockActions[current.dockFocus];
        if (act) current.onSelectDockAction(act, current.dockFocus);
      }
    });
  }, [open]);

  if (!open) return null;

  const focusedAction = dockActions[dockFocus];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} accessibilityViewIsModal>
      {/* Lớp kính mờ cao cấp PS5 */}
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Gradient chuyển bóng tinh tế */}
      <LinearGradient
        colors={[alpha(colors.bgDeep, 0.82), alpha(colors.bgDeep, 0.25), alpha(colors.bgDeep, 0.88)]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* 1. GÓC TRÊN PHẢI: Nút đóng */}
      <View style={[styles.topBar, { top: insets.top + s(10), right: insets.right + s(24), gap: s(6) }]}>
        {/* Nút đóng menu */}
        <Press
          onPress={handleClose}
          sound="back"
          accessibilityLabel="Đóng menu tiếp tục chơi"
          style={[styles.closeBtn, { width: s(32), height: s(32), borderRadius: s(16) }]}
        >
          <X size={s(15)} color="rgba(255,255,255,0.65)" />
        </Press>
      </View>

      {/* 3. THANH DOCK PHÍA DƯỚI (PHONG CÁCH PS5 ẢNH 2): 10 BIỂU TƯỢNG TINH GỌN */}
      <View style={[styles.dockWrapper, { bottom: s(12) + insets.bottom }]}>
        {/* Nhãn tooltip nổi bật hiển thị khi hover / chọn icon (không làm phình to thanh dock) */}
        {focusedAction ? (
          <View style={styles.dockTooltipWrap}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <T size={11} weight="semibold" color="#ffffff">
              {focusedAction.label}
              {focusedAction.badge ? ` (${focusedAction.badge})` : ''}
            </T>
          </View>
        ) : null}

        <View style={[styles.dockBar, { borderRadius: s(22), padding: s(5) }]}>
          <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 3 }}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(4), alignItems: 'center' }}>
            {dockActions.map((action, index) => {
              const Icon = action.icon;
              const isFocused = dockFocus === index;
              const hasBadge = action.badge !== null && action.badge !== undefined;
              const popoverOpen = Boolean(action.popover && popover?.id === action.popover);
              const lit = isFocused || popoverOpen;

              return (
                // Khung bọc để đo vị trí nút: popover bung ra và viền streaming toả ra đúng từ đây.
                <View
                  key={action.id}
                  collapsable={false}
                  ref={(node) => {
                    if (node) dockNodes.set(action.id, node);
                    else dockNodes.delete(action.id);
                  }}
                >
                  <Press
                    disabled={Boolean(busy)}
                    onPress={() => onSelectDockAction(action, index)}
                    pressScale={0.92}
                    accessibilityLabel={action.label}
                    style={[
                      styles.dockIconBtn,
                      {
                        width: s(42),
                        height: s(42),
                        borderRadius: s(14),
                        backgroundColor: lit
                          ? (action.danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.18)')
                          : 'transparent',
                        borderWidth: isFocused ? 1.5 : 0,
                        borderColor: action.danger ? 'rgba(248,113,113,0.8)' : '#ffffff',
                      },
                    ]}
                  >
                    {busy === action.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : action.id === 'game' ? (
                      <View style={[styles.dockGameTile, { width: s(30), height: s(30), borderRadius: s(9), borderColor: isFocused ? '#ffffff' : 'rgba(255,255,255,0.3)' }]}>
                        {gameArtwork ? (
                          <Img source={{ uri: gameArtwork }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : (
                          <Icon size={s(16)} color="#ffffff" />
                        )}
                      </View>
                    ) : action.id === 'profile' ? (
                      <UserAvatar
                        uri={profile?.avatarUrl ?? null}
                        name={profile?.name || 'Người dùng'}
                        size={s(lit ? 28 : 26)}
                        ring={lit}
                      />
                    ) : (
                      <Icon
                        size={s(19)}
                        color={
                          action.id === 'stream' && watchParty.live
                            ? '#57eda4'
                            : action.danger
                              ? '#f87171'
                              : lit
                                ? '#ffffff'
                                : 'rgba(255,255,255,0.65)'
                        }
                      />
                    )}

                    {hasBadge ? (
                      <View style={styles.dockBadge}>
                        <T size={8.5} weight="bold" color="#ffffff" tabular>
                          {action.badge}
                        </T>
                      </View>
                    ) : action.dot ? (
                      <View style={styles.dockLiveDot} />
                    ) : null}
                  </Press>
                </View>
              );
            })}
          </ScrollView>

          {/* Đồng hồ nằm ngay trong dock */}
          <View style={[styles.dockDivider, { height: s(22), marginHorizontal: s(8) }]} />
          <T size={13} weight="semibold" color="rgba(255,255,255,0.9)" tabular style={{ marginRight: s(8) }}>
            {timeStr}
          </T>
        </View>
      </View>

      {/* Popover kiểu Apple bung ra từ nút Thông báo / Thiết bị / Tài khoản */}
      <ControlPopover
        open={popover !== null}
        anchor={popover?.anchor ?? null}
        title={popoverShown === 'devices' ? 'Thiết bị' : popoverShown === 'profile' ? 'Tài khoản' : 'Thông báo'}
        icon={popoverShown === 'devices' ? Gamepad2 : popoverShown === 'profile' ? UserRound : Bell}
        accent={popoverShown === 'notifications' ? '#ff9f0a' : popoverShown === 'devices' ? '#34c759' : '#bf5af2'}
        width={popoverShown === 'notifications' ? 360 : 320}
        action={popoverShown === 'notifications' && unreadCount > 0 ? (
          <Press onPress={() => void markAllAsRead()} hitSlop={8}>
            <T size={10} weight="semibold" color="#64a8ff">Đánh dấu đã đọc</T>
          </Press>
        ) : null}
        onClose={closePopover}
      >
        {popoverShown === 'devices' ? (
          <DevicesPanel devices={devices} />
        ) : popoverShown === 'profile' ? (
          <ProfilePanel
            name={profile?.name || 'Người dùng'}
            email={profile?.email ?? null}
            avatarUrl={profile?.avatarUrl ?? null}
            status={watchParty.live ? 'Đang điều khiển PC · đang streaming' : 'Đang điều khiển PC'}
          />
        ) : (
          <NotificationsPanel notifications={notifications} />
        )}
      </ControlPopover>

      {/* Toast phản hồi hành động nhẹ nhàng, không tạo noise */}
      {toastMessage || status ? (
        <View pointerEvents="none" style={[styles.toastFloating, { bottom: s(86) + insets.bottom }]}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          <T size={11.5} weight="medium" color="rgba(255,255,255,0.88)">
            {toastMessage || status}
          </T>
        </View>
      ) : null}

      {/* MODAL XEM VÀ SAO CHÉP ẢNH CHỤP */}
      {shot ? (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { maxWidth: s(600), borderRadius: s(22) }]}>
            <Img source={{ uri: `data:image/png;base64,${shot}` }} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }} contentFit="contain" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: s(14) }}>
              <T size={11} color="rgba(255,255,255,0.6)">Ảnh đã chụp từ màn hình stream</T>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                <Press onPress={() => setShot(null)} sound="back" style={[styles.modalBtnSec, { height: s(36), borderRadius: s(12), paddingHorizontal: s(14) }]}>
                  <T size={11} color="rgba(255,255,255,0.7)">Đóng</T>
                </Press>
                <Press
                  onPress={() => void run('copy', async () => { await Clipboard.setImageAsync(shot); }, 'Đã chép ảnh vào clipboard.')}
                  style={[styles.modalBtnPri, { height: s(36), borderRadius: s(12), paddingHorizontal: s(14) }]}
                >
                  <Copy size={s(13)} color="#ffffff" />
                  <T size={11} weight="semibold" color="#ffffff">Sao chép</T>
                </Press>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* MODAL XÁC NHẬN THOÁT GAME */}
      {confirmExit ? (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { maxWidth: s(380), alignItems: 'center', padding: s(22), borderRadius: s(22) }]}>
            <View style={[styles.dangerIconCircle, { width: s(48), height: s(48), borderRadius: s(24) }]}>
              <LogOut size={s(20)} color="#f87171" />
            </View>
            <T size={16} weight="bold" color="#ffffff" style={{ marginTop: s(12) }}>
              Thoát game và dừng stream?
            </T>
            <T size={11.5} color="rgba(255,255,255,0.55)" leading={1.5} style={{ marginTop: s(6), textAlign: 'center' }}>
              Phiên chơi trên PC sẽ đóng lại và đưa bạn trở về kệ game.
            </T>
            <View style={{ flexDirection: 'row', gap: s(10), marginTop: s(18) }}>
              <Press onPress={() => setConfirmExit(false)} style={[styles.modalBtnSec, { height: s(38), borderRadius: s(12), paddingHorizontal: s(16) }]}>
                <T size={11.5} weight="semibold" color="rgba(255,255,255,0.7)">Hủy</T>
              </Press>
              <Press onPress={exitGame} style={[styles.dangerBtnPri, { height: s(38), borderRadius: s(12), paddingHorizontal: s(16) }]}>
                <LogOut size={s(13)} color="#ffffff" />
                <T size={11.5} weight="bold" color="#ffffff">Thoát game</T>
              </Press>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles(({ glass, colors }) => ({
  root: {
    backgroundColor: alpha(colors.bgDeep, 0.82),
    zIndex: 160,
    elevation: 160,
  },
  topBar: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 20,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dockWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  dockTooltipWrap: {
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,19,28,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...glassShadowSubtle,
  },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(12,15,24,0.78)',
    ...glassShadow,
  },
  dockIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dockGameTile: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dockBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#ef4444',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dockLiveDot: {
    position: 'absolute',
    bottom: 1,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4ade80',
  },
  toastFloating: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,20,30,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...glassShadowSubtle,
    zIndex: 40,
  },
  modalOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.bgDeep, 0.75),
    zIndex: 100,
    padding: 20,
  },
  modalCard: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: glass.modal,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...glassShadow,
  },
  modalBtnSec: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalBtnPri: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  dangerIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  dangerBtnPri: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
}));
