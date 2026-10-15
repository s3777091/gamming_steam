// Menu Guide (PS5 Control Center style): mở bằng Alt hoặc Start + Select.
// Thiết kế tinh gọn, trực quan, không tạo noise.
//
// Hàng trên: Đồng hồ thời gian thực, trạng thái tay cầm / kết nối.
// Vùng giữa: Băng chuyền thẻ Control Center (Thẻ game đang chơi, Watch Party,
//            Thao tác nhanh / Chụp ảnh, Thiết bị kết nối, Thông báo).
// Thanh dock dưới: 10 biểu tượng chức năng tinh gọn, có badge hiển thị số thông báo.
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
  Battery,
  Bell,
  Bluetooth,
  Camera,
  Check,
  Copy,
  Gamepad2,
  Headphones,
  Home,
  Layers3,
  LogOut,
  Play,
  Power,
  Radio,
  RotateCw,
  Tv,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { addListener, exportFrame, releaseFrame } from 'jetsona-input';

import { useInputDevices } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { useNotifications } from '@/features/library/useNotifications';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import type { PendingGameLaunch } from '@/lib/game-launch';
import type { StreamSettings } from '@/lib/stream-settings';
import { PC_ROUTES, pcFetch, pcPostJson } from '@/lib/pc-api';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, glassShadow, glassShadowSubtle } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

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

type CardId = 'game' | 'party' | 'capture' | 'devices' | 'notifications' | 'profile';

type DockAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  targetCard?: CardId;
  badge?: number | string | null;
  dot?: boolean;
  run?: () => void;
};

function BatteryGauge({
  percent,
  size = 'small',
}: {
  percent: number | null;
  size?: 'small' | 'medium';
}) {
  const { s } = useUi();
  if (percent === null) {
    return <Battery size={size === 'small' ? s(13) : s(16)} color="rgba(255,255,255,0.45)" />;
  }

  const fillColor = percent > 40 ? '#4ade80' : percent > 20 ? '#facc15' : '#f87171';
  const width = size === 'small' ? s(15) : s(20);
  const height = size === 'small' ? s(8) : s(10);
  const fillWidth = Math.min(100, Math.max(8, percent));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width,
          height,
          borderRadius: s(2),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.75)',
          padding: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
      >
        <View
          style={{
            width: `${fillWidth}%`,
            height: '100%',
            borderRadius: 1,
            backgroundColor: fillColor,
          }}
        />
      </View>
      <View
        style={{
          width: s(1.5),
          height: height * 0.45,
          borderTopRightRadius: 1,
          borderBottomRightRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.75)',
        }}
      />
    </View>
  );
}

async function gameRuntime(action: 'focus' | 'quit', gameId: string | null) {
  await pcPostJson(PC_ROUTES.gameRuntime, { action, gameId: gameId ?? '' }, 'Không điều khiển được game.');
}

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
  onSwitched,
  onExitGame,
}: {
  open: boolean;
  profile: { name: string; avatarUrl: string | null } | null;
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
  onSwitched: () => void;
  onExitGame: () => void;
}) {
  const { s, insets, width } = useUi();
  const fade = useMemo(() => new Animated.Value(0), []);
  const { devices } = useInputDevices();
  const { unreadCount, notifications, markAllAsRead } = useNotifications();

  const [games, setGames] = useState<RunningGame[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [timeStr, setTimeStr] = useState(() => formatClock(new Date()));

  // D-pad navigation: row 0 = Cards Carousel, row 1 = Bottom Dock
  const [row, setRow] = useState<0 | 1>(1);
  const [dockFocus, setDockFocus] = useState(0);
  const [cardFocus, setCardFocus] = useState(0);

  const cardsScrollRef = useRef<ScrollView>(null);
  const CARD_WIDTH = Math.min(s(280), width * 0.45);
  const CARD_GAP = s(14);

  const handleClose = useCallback(() => {
    setShot(null);
    setConfirmExit(false);
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
    try {
      await Clipboard.setImageAsync(base64);
      setToastMessage('Đã chụp và lưu ảnh vào clipboard.');
    } catch {
      setToastMessage('Đã chụp màn hình.');
    }
  }), [hasFrame, run]);

  const toggleStreaming = useCallback(() => {
    if (watchParty.live) {
      watchParty.stop();
      setToastMessage('Đã dừng phát trực tiếp.');
    } else {
      void watchParty.start();
      setToastMessage('Đang khởi tạo phòng xem trực tiếp...');
    }
  }, [watchParty]);

  const switchGame = useCallback((game: RunningGame) => void run(`game:${game.id}`, async () => {
    await gameRuntime('focus', game.id);
    onSwitched();
  }), [onSwitched, run]);

  const exitGame = useCallback(() => void run('exit', async () => {
    const targetId = games.find((g) => g.active)?.id ?? launch?.gameId ?? null;
    await gameRuntime('quit', targetId);
    onExitGame();
  }), [games, launch?.gameId, onExitGame, run]);

  // Tính số lượng thông báo chính xác
  const totalNotifs = notificationCountProp !== undefined
    ? notificationCountProp
    : (unreadCount > 0 ? unreadCount : notifications.length);

  // Cuộn băng chuyền thẻ đến vị trí mong muốn
  const scrollToCardIndex = useCallback((index: number) => {
    setCardFocus(index);
    cardsScrollRef.current?.scrollTo({
      x: Math.max(0, index * (CARD_WIDTH + CARD_GAP) - s(32)),
      animated: true,
    });
  }, [CARD_GAP, CARD_WIDTH, s]);

  // Thông tin game đang hiển thị
  const activeGame = games.find((g) => g.active) ?? null;
  const gameTitle = activeGame?.title || launch?.title || 'Phiên stream PC';
  const gameArtwork = activeGame?.heroUrl || activeGame?.artworkUrl || launch?.heroUrl || launch?.logoUrl || null;
  const resolutionText = videoSize?.height ? `${videoSize.height}p` : '1080p';
  const fpsText = streamSettings?.frame_rate ? `${streamSettings.frame_rate} FPS` : '60 FPS';

  // Dung lượng pin chính xác của tay cầm kết nối
  const controllers = useMemo(() => devices.filter((d) => d.kind === 'controller'), [devices]);
  const primaryController = controllers[0] ?? devices[0] ?? null;
  const batteryPercent = primaryController?.battery !== null && primaryController?.battery !== undefined
    ? Math.round(primaryController.battery * 100)
    : null;

  // Các icon chức năng chuẩn trong Dock (Đã bỏ Clipboard theo yêu cầu, thiết bị có pin chính xác)
  const dockActions: DockAction[] = useMemo(() => [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      run: onHome,
    },
    {
      id: 'games',
      label: 'Tab game',
      icon: Layers3,
      targetCard: 'game',
      badge: games.length > 1 ? games.length : null,
    },
    {
      id: 'notifications',
      label: 'Thông báo',
      icon: Bell,
      targetCard: 'notifications',
      badge: totalNotifs > 0 ? (totalNotifs > 99 ? '99+' : totalNotifs) : null,
    },
    {
      id: 'stream',
      label: 'Streaming',
      icon: Radio,
      targetCard: 'party',
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
      label: batteryPercent !== null ? `Tay cầm (${batteryPercent}%)` : 'Thiết bị',
      icon: Gamepad2,
      targetCard: 'devices',
      badge: devices.length > 0 ? devices.length : 1,
    },
    {
      id: 'reload',
      label: 'Tải lại',
      icon: RotateCw,
      run: onReload,
    },
    {
      id: 'profile',
      label: 'Tài khoản',
      icon: UserRound,
      targetCard: 'profile',
    },
    {
      id: 'exit',
      label: 'Thoát game',
      icon: Power,
      danger: true,
      run: () => setConfirmExit(true),
    },
  ], [batteryPercent, devices.length, games.length, onHome, onReload, takeScreenshot, totalNotifs, watchParty.live]);

  // Danh sách các thẻ hiển thị trong băng chuyền
  const carouselCards = useMemo(() => {
    const list: { id: CardId; type: 'current_game' | 'bg_game' | 'party' | 'capture' | 'devices' | 'notifications' | 'profile'; game?: RunningGame }[] = [
      { id: 'game', type: 'current_game' },
    ];

    // Thêm các game đang chạy nền khác nếu có
    games.filter((g) => !g.active && g.id !== launch?.gameId).forEach((bgGame) => {
      list.push({ id: 'game', type: 'bg_game', game: bgGame });
    });

    list.push({ id: 'party', type: 'party' });
    list.push({ id: 'capture', type: 'capture' });
    list.push({ id: 'devices', type: 'devices' });
    list.push({ id: 'notifications', type: 'notifications' });
    list.push({ id: 'profile', type: 'profile' });

    return list;
  }, [games, launch?.gameId]);

  const onSelectDockAction = useCallback((action: DockAction, index: number) => {
    setDockFocus(index);
    if (action.run) {
      action.run();
    } else if (action.targetCard) {
      const cardIndex = carouselCards.findIndex((c) => c.id === action.targetCard);
      if (cardIndex >= 0) {
        scrollToCardIndex(cardIndex);
      }
    }
  }, [carouselCards, scrollToCardIndex]);

  // Điều khiển bằng tay cầm (D-pad & nút bấm A/B)
  const stateRef = useRef({
    row,
    dockFocus,
    cardFocus,
    dockActions,
    carouselCards,
    confirmExit,
    shot,
    onSelectDockAction,
    onClose,
    exitGame,
    switchGame,
    toggleStreaming,
    takeScreenshot,
    scrollToCardIndex,
  });
  useEffect(() => {
    stateRef.current = {
      row,
      dockFocus,
      cardFocus,
      dockActions,
      carouselCards,
      confirmExit,
      shot,
      onSelectDockAction,
      onClose: handleClose,
      exitGame,
      switchGame,
      toggleStreaming,
      takeScreenshot,
      scrollToCardIndex,
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

      // D-pad Navigation
      if (current.row === 1) {
        // Đang ở Thanh Dock dưới
        if (event.button === 'left') {
          playUiSound('navigate');
          const next = Math.max(0, current.dockFocus - 1);
          setDockFocus(next);
        } else if (event.button === 'right') {
          playUiSound('navigate');
          const next = Math.min(current.dockActions.length - 1, current.dockFocus + 1);
          setDockFocus(next);
        } else if (event.button === 'up') {
          playUiSound('navigate');
          setRow(0);
        } else if (event.button === 'a') {
          playUiSound('select');
          const act = current.dockActions[current.dockFocus];
          if (act) current.onSelectDockAction(act, current.dockFocus);
        }
      } else {
        // Đang ở Băng chuyền Thẻ (row 0)
        if (event.button === 'left') {
          playUiSound('navigate');
          const next = Math.max(0, current.cardFocus - 1);
          current.scrollToCardIndex(next);
        } else if (event.button === 'right') {
          playUiSound('navigate');
          const next = Math.min(current.carouselCards.length - 1, current.cardFocus + 1);
          current.scrollToCardIndex(next);
        } else if (event.button === 'down') {
          playUiSound('navigate');
          setRow(1);
        } else if (event.button === 'a') {
          playUiSound('select');
          const targetCard = current.carouselCards[current.cardFocus];
          if (targetCard) {
            if (targetCard.type === 'current_game') current.onClose();
            else if (targetCard.type === 'bg_game' && targetCard.game) current.switchGame(targetCard.game);
            else if (targetCard.type === 'party') current.toggleStreaming();
            else if (targetCard.type === 'capture') current.takeScreenshot();
          }
        }
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
        colors={['rgba(5,7,12,0.82)', 'rgba(5,7,12,0.25)', 'rgba(5,7,12,0.88)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* 1. THANH TRÊN CÙNG: Đồng hồ thời gian thực, huy hiệu tay cầm & nút đóng */}
      <View style={[styles.topBar, { top: insets.top + s(10), left: insets.left + s(24), right: insets.right + s(24) }]}>
        <View style={styles.topBrandWrap}>
          <View style={styles.topDot} />
          <T size={12} weight="semibold" color="rgba(255,255,255,0.78)" tracking={0.5}>
            CONTROL CENTER
          </T>
        </View>

        <View style={styles.topRightControls}>
          {/* Huy hiệu tay cầm / pin (giống số 4 tròn trong ảnh 2) */}
          <View style={[styles.topCircleBadge, { height: s(30), paddingHorizontal: s(8), borderRadius: s(15) }]}>
            <Gamepad2 size={s(14)} color="rgba(255,255,255,0.85)" />
            <T size={10} weight="bold" color="rgba(255,255,255,0.9)" tabular style={{ marginLeft: s(3) }}>
              {devices.length || 1}
            </T>
            {batteryPercent !== null ? (
              <View style={{ marginLeft: s(6), flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
                <BatteryGauge percent={batteryPercent} size="small" />
                <T size={9.5} weight="bold" color="#4ade80" tabular>
                  {batteryPercent}%
                </T>
              </View>
            ) : null}
          </View>

          {/* Đồng hồ số như ảnh 2 (e.g. 4:38 PM) */}
          <T size={14} weight="semibold" color="rgba(255,255,255,0.92)" tabular style={styles.clockText}>
            {timeStr}
          </T>

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
      </View>

      {/* 2. VÙNG GIỮA: BĂNG CHUYỀN THẺ CONTROL CENTER (ẢNH 2) */}
      <View style={[styles.carouselContainer, { paddingBottom: s(84) + insets.bottom }]}>
        <ScrollView
          ref={cardsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.cardsScrollContent,
            {
              paddingLeft: insets.left + s(28),
              paddingRight: insets.right + s(28),
              gap: CARD_GAP,
            },
          ]}
        >
          {carouselCards.map((card, idx) => {
            const isCardFocused = row === 0 && cardFocus === idx;

            // THẺ 1: GAME ĐANG HIỂN THỊ (CURRENT GAME CARD)
            if (card.type === 'current_game') {
              return (
                <Press
                  key="card_current_game"
                  onPress={handleClose}
                  pressScale={0.98}
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.18)',
                      borderWidth: isCardFocused ? 2 : 1,
                    },
                  ]}
                >
                  {gameArtwork ? (
                    <Img source={{ uri: gameArtwork }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#181b26' }]} />
                  )}

                  {/* Lớp phủ chuyển màu gradient */}
                  <LinearGradient
                    colors={['rgba(9,11,18,0.3)', 'rgba(9,11,18,0.92)']}
                    locations={[0.2, 0.95]}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Header thẻ: Huy hiệu LIVE & thông số luồng */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.liveTag}>
                      <View style={styles.liveGreenDot} />
                      <T size={9.5} weight="bold" color="#4ade80">ĐANG PHÁT</T>
                    </View>
                    <View style={styles.statTag}>
                      <T size={9.5} weight="semibold" color="rgba(255,255,255,0.72)" tabular>
                        {resolutionText} • {fpsText}
                      </T>
                    </View>
                  </View>

                  {/* Nội dung dưới của thẻ */}
                  <View style={styles.cardBottomArea}>
                    <T size={10} weight="medium" color="rgba(255,255,255,0.5)">
                      Trò chơi đang hiển thị
                    </T>
                    <T size={14.5} weight="bold" numberOfLines={1} color="#ffffff" style={{ marginTop: s(2) }}>
                      {gameTitle}
                    </T>

                    <View style={styles.cardActionRow}>
                      <Play size={s(11)} color="#a5b4fc" />
                      <T size={10.5} weight="semibold" color="#c7d2fe">Chạm để tiếp tục chơi</T>
                    </View>
                  </View>
                </Press>
              );
            }

            // THẺ CÁC GAME NỀN KHÁC (NẾU CÓ ĐA NHIỆM)
            if (card.type === 'bg_game' && card.game) {
              const bg = card.game;
              const bgArt = bg.heroUrl || bg.artworkUrl;
              return (
                <Press
                  key={`card_bg_${bg.id}`}
                  onPress={() => switchGame(bg)}
                  pressScale={0.98}
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.14)',
                      borderWidth: isCardFocused ? 2 : 1,
                    },
                  ]}
                >
                  {bgArt ? (
                    <Img source={{ uri: bgArt }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#141722' }]} />
                  )}
                  <LinearGradient
                    colors={['rgba(9,11,18,0.3)', 'rgba(9,11,18,0.92)']}
                    locations={[0.2, 0.95]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.liveTag, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <T size={9.5} weight="bold" color="rgba(255,255,255,0.7)">CHẠY NỀN</T>
                    </View>
                  </View>
                  <View style={styles.cardBottomArea}>
                    <T size={10} color="rgba(255,255,255,0.5)">Nhấn để chuyển sang</T>
                    <T size={14} weight="bold" numberOfLines={1} color="#ffffff" style={{ marginTop: s(2) }}>
                      {bg.title}
                    </T>
                    <View style={styles.cardActionRow}>
                      <Layers3 size={s(11)} color="#93c5fd" />
                      <T size={10.5} weight="semibold" color="#bfdbfe">Chuyển sang game này</T>
                    </View>
                  </View>
                </Press>
              );
            }

            // THẺ 2: WATCH PARTY / CHIA SẺ MÀN HÌNH (SHARE SCREEN GIỐNG ẢNH 2)
            if (card.type === 'party') {
              return (
                <View
                  key="card_party"
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.14)',
                      borderWidth: isCardFocused ? 2 : 1,
                      backgroundColor: watchParty.live ? 'rgba(30,41,59,0.7)' : 'rgba(17,21,30,0.65)',
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.liveTag, { backgroundColor: watchParty.live ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.1)' }]}>
                      <Radio size={s(10)} color={watchParty.live ? '#4ade80' : 'rgba(255,255,255,0.7)'} />
                      <T size={9.5} weight="bold" color={watchParty.live ? '#4ade80' : 'rgba(255,255,255,0.7)'}>
                        {watchParty.live ? 'LIVE' : 'PHÒNG XEM'}
                      </T>
                    </View>
                    <Tv size={s(13)} color="rgba(255,255,255,0.4)" />
                  </View>

                  <View style={styles.partyCenterGraphic}>
                    <View style={[styles.partyRadarCircle, { width: s(44), height: s(44), borderRadius: s(22) }]}>
                      <Users size={s(18)} color={watchParty.live ? '#4ade80' : 'rgba(255,255,255,0.65)'} />
                    </View>
                  </View>

                  <View style={styles.cardBottomArea}>
                    <T size={10} color="rgba(255,255,255,0.5)">
                      {watchParty.live ? 'Đang phát sóng trực tiếp' : 'Chia sẻ màn hình cho bạn bè'}
                    </T>
                    <T size={13.5} weight="bold" numberOfLines={1} color="#ffffff" style={{ marginTop: s(2) }}>
                      {watchParty.live ? `${watchParty.viewers.length} người đang xem` : 'Mở phòng xem'}
                    </T>

                    <Press
                      disabled={watchParty.busy}
                      onPress={toggleStreaming}
                      style={[
                        styles.cardBtnPill,
                        {
                          backgroundColor: watchParty.live ? 'rgba(239,68,68,0.22)' : 'rgba(99,102,241,0.3)',
                          borderColor: watchParty.live ? 'rgba(248,113,113,0.4)' : 'rgba(129,140,248,0.4)',
                        },
                      ]}
                    >
                      {watchParty.busy ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <T size={10.5} weight="semibold" color={watchParty.live ? '#fca5a5' : '#c7d2fe'}>
                          {watchParty.live ? 'Dừng phòng xem' : 'Bật phát trực tiếp'}
                        </T>
                      )}
                    </Press>
                  </View>
                </View>
              );
            }

            // THẺ 3: CHỤP ẢNH MÀN HÌNH (SCREENSHOT)
            if (card.type === 'capture') {
              return (
                <View
                  key="card_capture"
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.14)',
                      borderWidth: isCardFocused ? 2 : 1,
                      backgroundColor: 'rgba(17,21,30,0.65)',
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.liveTag}>
                      <Camera size={s(10)} color="#a5b4fc" />
                      <T size={9.5} weight="bold" color="#c7d2fe">CHỤP ẢNH</T>
                    </View>
                    <T size={9.5} color="rgba(255,255,255,0.4)" tabular>{resolutionText}</T>
                  </View>

                  <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: s(12) }}>
                    <Press
                      onPress={takeScreenshot}
                      pressScale={0.97}
                      style={[styles.toolRowBtn, { height: s(38), borderRadius: s(12) }]}
                    >
                      <Camera size={s(14)} color="#ffffff" />
                      <T size={11.5} weight="bold" color="#ffffff">Chụp màn hình ngay</T>
                    </Press>
                  </View>

                  <View style={[styles.cardBottomArea, { paddingTop: 0 }]}>
                    <T size={9.5} color="rgba(255,255,255,0.4)">Tự động lưu vào clipboard thiết bị</T>
                  </View>
                </View>
              );
            }

            // THẺ 4: THIẾT BỊ ĐÃ KẾT NỐI
            if (card.type === 'devices') {
              return (
                <View
                  key="card_devices"
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.14)',
                      borderWidth: isCardFocused ? 2 : 1,
                      backgroundColor: 'rgba(17,21,30,0.65)',
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.liveTag}>
                      <Gamepad2 size={s(10)} color="#a5b4fc" />
                      <T size={9.5} weight="bold" color="#c7d2fe">
                        THIẾT BỊ ({devices.length})
                      </T>
                    </View>
                    <Bluetooth size={s(13)} color="rgba(255,255,255,0.4)" />
                  </View>

                  <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: s(12), gap: s(6) }}>
                    {devices.length > 0 ? (
                      devices.slice(0, 2).map((dev) => {
                        const Icon = dev.bluetooth && dev.kind !== 'headset' ? Bluetooth : dev.kind === 'headset' ? Headphones : KIND_ICONS[dev.kind];
                        const devBatteryPercent = dev.battery !== null ? Math.round(dev.battery * 100) : null;
                        return (
                          <View key={dev.id} style={styles.deviceMiniItem}>
                            <Icon size={s(13)} color="#b9adff" />
                            <T size={11} weight="medium" numberOfLines={1} color="rgba(255,255,255,0.88)" style={{ flex: 1 }}>
                              {dev.name}
                            </T>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                              <BatteryGauge percent={devBatteryPercent} size="small" />
                              <T size={10} weight="semibold" color={devBatteryPercent !== null && devBatteryPercent <= 20 ? '#f87171' : '#4ade80'} tabular>
                                {devBatteryPercent === null ? 'Đã nối' : `${devBatteryPercent}%`}
                              </T>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Gamepad2 size={s(20)} color="rgba(255,255,255,0.3)" />
                        <T size={10.5} color="rgba(255,255,255,0.45)" style={{ marginTop: s(4) }}>
                          Cảm ứng màn hình đang bật
                        </T>
                      </View>
                    )}
                  </View>

                  <View style={[styles.cardBottomArea, { paddingTop: 0 }]}>
                    <T size={9.5} color="rgba(255,255,255,0.4)">
                      {devices.length > 0 ? `${devices.length} phụ kiện kết nối` : 'Sẵn sàng nhận tay cầm ngoài'}
                    </T>
                  </View>
                </View>
              );
            }

            // THẺ 5: THÔNG BÁO (NOTIFICATIONS)
            if (card.type === 'notifications') {
              const latestNotif = notifications[0];
              return (
                <View
                  key="card_notifs"
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.14)',
                      borderWidth: isCardFocused ? 2 : 1,
                      backgroundColor: 'rgba(17,21,30,0.65)',
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.liveTag}>
                      <Bell size={s(10)} color="#fca5a5" />
                      <T size={9.5} weight="bold" color="#fca5a5">
                        THÔNG BÁO ({totalNotifs})
                      </T>
                    </View>
                    {totalNotifs > 0 ? (
                      <View style={styles.notifCountTag}>
                        <T size={9} weight="bold" color="#ffffff">{totalNotifs}</T>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: s(12) }}>
                    {latestNotif ? (
                      <View>
                        <T size={10} color="#93c5fd" weight="semibold">
                          {latestNotif.type === 'discount' ? 'Ưu đãi mới' : latestNotif.type === 'update' ? 'Bản cập nhật' : 'Thông báo'}
                        </T>
                        <T size={12} weight="bold" numberOfLines={1} color="#ffffff" style={{ marginTop: s(2) }}>
                          {latestNotif.gameTitle}
                        </T>
                        <T size={10} color="rgba(255,255,255,0.55)" numberOfLines={1} style={{ marginTop: s(2) }}>
                          {latestNotif.type === 'discount' ? `Giảm ${latestNotif.discountPercent}% trên Steam` : 'Có sẵn trên PC'}
                        </T>
                      </View>
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Check size={s(18)} color="rgba(255,255,255,0.3)" />
                        <T size={10.5} color="rgba(255,255,255,0.4)" style={{ marginTop: s(4) }}>
                          Không có thông báo chưa đọc
                        </T>
                      </View>
                    )}
                  </View>

                  <View style={[styles.cardBottomArea, { paddingTop: 0 }]}>
                    {unreadCount > 0 ? (
                      <Press onPress={() => void markAllAsRead()} style={{ alignSelf: 'flex-start' }}>
                        <T size={9.5} weight="semibold" color="#93c5fd">Đánh dấu tất cả đã đọc</T>
                      </Press>
                    ) : (
                      <T size={9.5} color="rgba(255,255,255,0.4)">Cập nhật từ PC & Steam</T>
                    )}
                  </View>
                </View>
              );
            }

            // THẺ 6: TÀI KHOẢN (PROFILE)
            if (card.type === 'profile') {
              return (
                <View
                  key="card_profile"
                  style={[
                    styles.cardBase,
                    {
                      width: CARD_WIDTH,
                      borderRadius: s(18),
                      borderColor: isCardFocused ? '#ffffff' : 'rgba(255,255,255,0.14)',
                      borderWidth: isCardFocused ? 2 : 1,
                      backgroundColor: 'rgba(17,21,30,0.65)',
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.liveTag}>
                      <UserRound size={s(10)} color="#a5b4fc" />
                      <T size={9.5} weight="bold" color="#c7d2fe">NGƯỜI CHƠI</T>
                    </View>
                  </View>

                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={[styles.profileAvatarWrap, { width: s(44), height: s(44), borderRadius: s(22) }]}>
                      {profile?.avatarUrl ? (
                        <Img source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <UserRound size={s(20)} color="rgba(255,255,255,0.6)" />
                      )}
                    </View>
                    <T size={13} weight="bold" color="#ffffff" numberOfLines={1} style={{ marginTop: s(6) }}>
                      {profile?.name || 'Người điều khiển'}
                    </T>
                    <T size={9.5} color="#4ade80" style={{ marginTop: s(2) }}>
                      ● Đang kết nối
                    </T>
                  </View>

                  <View style={[styles.cardBottomArea, { paddingTop: 0 }]}>
                    <T size={9.5} color="rgba(255,255,255,0.4)">Phiên điều khiển độc quyền</T>
                  </View>
                </View>
              );
            }

            return null;
          })}
        </ScrollView>

        {/* Gợi ý nút bấm Options / Gamepad giống ảnh 2 dưới thẻ */}
        <View style={styles.bottomHintWrap}>
          <View style={styles.hintTag}>
            <T size={10} weight="semibold" color="rgba(255,255,255,0.45)">
              [A] Chọn   [B] Trở lại game
            </T>
          </View>
        </View>
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
              const isFocused = row === 1 && dockFocus === index;
              const hasBadge = action.badge !== null && action.badge !== undefined;

              return (
                <Press
                  key={action.id}
                  disabled={Boolean(busy)}
                  onPress={() => onSelectDockAction(action, index)}
                  pressScale={0.92}
                  accessibilityLabel={action.label}
                  style={[
                    styles.dockIconBtn,
                    {
                      width: action.id === 'devices' && batteryPercent !== null ? s(72) : s(42),
                      height: s(42),
                      paddingHorizontal: action.id === 'devices' && batteryPercent !== null ? s(6) : 0,
                      borderRadius: s(14),
                      backgroundColor: isFocused
                        ? (action.danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.18)')
                        : 'transparent',
                      borderWidth: isFocused ? 1.5 : 0,
                      borderColor: action.danger ? 'rgba(248,113,113,0.8)' : '#ffffff',
                    },
                  ]}
                >
                  {busy === action.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : action.id === 'devices' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                      <Icon
                        size={s(17)}
                        color={
                          action.danger
                            ? '#f87171'
                            : isFocused
                              ? '#ffffff'
                              : 'rgba(255,255,255,0.75)'
                        }
                      />
                      <BatteryGauge percent={batteryPercent} size="small" />
                      {batteryPercent !== null ? (
                        <T
                          size={9}
                          weight="bold"
                          color={batteryPercent > 20 ? '#ffffff' : '#f87171'}
                          tabular
                        >
                          {batteryPercent}%
                        </T>
                      ) : null}
                    </View>
                  ) : (
                    <Icon
                      size={s(19)}
                      color={
                        action.danger
                          ? '#f87171'
                          : isFocused
                            ? '#ffffff'
                            : 'rgba(255,255,255,0.65)'
                      }
                    />
                  )}

                  {/* RIÊNG ICON THÔNG BÁO VÀ THIẾT BỊ CÓ BADGE SỐ LƯỢNG RÕ RÀNG */}
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
              );
            })}
          </ScrollView>
        </View>
      </View>

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
                {busy === 'exit' ? <ActivityIndicator size="small" color="#ffffff" /> : <LogOut size={s(13)} color="#ffffff" />}
                <T size={11.5} weight="bold" color="#ffffff">Thoát game</T>
              </Press>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(4,6,10,0.82)',
    zIndex: 160,
    elevation: 160,
  },
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  topBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topCircleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  clockText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.5,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardsScrollContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cardBase: {
    height: 160,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,22,32,0.72)',
    ...glassShadow,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    zIndex: 2,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  statTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cardBottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    zIndex: 2,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  partyCenterGraphic: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyRadarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardBtnPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toolRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(99,102,241,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.4)',
  },
  toolRowBtnHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  deviceMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notifCountTag: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  profileAvatarWrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bottomHintWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  hintTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    bottom: 4,
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
    backgroundColor: 'rgba(4,6,10,0.75)',
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
});
