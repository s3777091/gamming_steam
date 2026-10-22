// Màn chính của app: tab Games (kệ game trên PC) và tab Store (Steam), cài đặt,
// hồ sơ Steam. Bản native của components/MobileVersionSelector.tsx — cùng bố cục
// ngang, cùng thao tác, cùng dữ liệu.

import { usePathname, useRouter } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';

import { useSignedInUser } from '@/features/auth';
import { resetFocusToTab } from '@/features/gamepad/focus';
import { useBack, useGamepadTabs, useGuide } from '@/features/gamepad/hooks';
import { HomeControlCenter } from '@/features/control-center/HomeControlCenter';
import { VirtualKeyboard } from '@/features/stream/VirtualKeyboard';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCaptureMode } from '@/features/gamepad/captureMode';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { formatStorePrice, isSteamAppId } from '@/features/library/format';
import type { DownloadItem } from '@/features/library/DownloadNotificationCard';
import { GameDetailPanel } from '@/features/library/GamePanels';
import { NotificationsPanel } from '@/features/library/NotificationsPanel';
import { PromotionPanel, SteamProfilePanel } from '@/features/library/ProfilePanels';
import { STORE_TAB_ORDER, type LibraryPanel, type PcGame, type SteamPromotion, type SteamStoreItem, type StoreTab } from '@/features/library/types';
import { useNotifications } from '@/features/library/useNotifications';
import { usePcLibrary } from '@/features/library/usePcLibrary';
import { useSteamDownloads } from '@/features/library/useSteamDownloads';
import { useSteamPurchase, useStoreOwnership } from '@/features/library/useSteamPurchase';
import { useSteamProfile } from '@/features/library/useSteamProfile';
import { useSteamStore, useStoreGameDetail, useStoreSearch } from '@/features/library/useSteamStore';
import { useDeviceStatus } from '@/features/devices/useDeviceStatus';
import { useInputDevices } from '@/features/devices/useInputDevices';
import ConsoleSettings, { type SettingsCategory } from '@/features/settings/ConsoleSettings';
import { clearPendingGameLaunch, savePendingGameLaunch } from '@/lib/game-launch';
import {
  hydrateResumableGame,
  readResumableGame,
  requestStreamResume,
  subscribeResumableGame,
  type ResumableGame,
} from '@/lib/stream-resume';
import { type GameDownload, allDownloads, downloadForApp, isDownloadActive, uninstallForApp } from '@/lib/steam-downloads';
import { type PurchaseOffer, type PurchaseTarget, purchaseKind } from '@/lib/steam-purchase';
import { makeStyles } from '@/theme';
import { useUi } from '@/ui/scale';
import { GlassBackdrop, GlassBlurProvider } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';

import { DeviceConnectionMenu } from './DeviceConnectionMenu';
import { type Flight, type FlightRect, DownloadFlight } from './DownloadFlight';
import { EulaSheet } from './DownloadViews';
import { GamesView } from './GamesView';
import { InstallConfigSheet } from './InstallConfigSheet';
import { LibraryHeader } from './LibraryHeader';
import { LibraryBackdrop, LibraryEmpty, LibrarySkeleton, PcWallpaper, StoreError, StoreLoading } from './LibraryStates';
import { PcPowerSheet } from './PcPowerSheet';
import { PcView } from './PcView';
import { PurchaseSheet } from './PurchaseSheet';
import { RemoteConnectionMenu } from './RemoteConnectionMenu';
import { usePcSleepWake } from './usePcSleepWake';
import { type StoreBuyAction, StoreGameDetail } from './StoreGameDetail';
import { StoreHome } from './StoreHome';
import { StoreSearchField, StoreSearchPanel } from './StoreSearch';
import { UninstallSheet } from './UninstallSheet';
import { GameOptionsModal } from './GameOptionsModal';
import { ConsoleTabTransition } from './ConsoleTabTransition';
import { CONSOLE } from './consoleVisuals';
import { T } from '@/ui/Text';

function ToastNotification({
  notice,
  onPress,
  onClose,
}: {
  notice: { id: number; title: string; message: string; gameImageUrl?: string | null };
  onPress?: () => void;
  onClose: () => void;
}) {
  const { s, width, insets } = useUi();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: insets.top + s(10),
        alignSelf: 'center',
        zIndex: 90,
        elevation: 90,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }}
    >
      <Press
        onPress={onPress}
        sound="confirm"
        pressScale={0.98}
        accessibilityLabel={notice.title}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: s(20),
          paddingHorizontal: s(14),
          paddingVertical: s(8),
          gap: s(10),
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          maxWidth: Math.min(s(440), width - s(32)),
        }}
      >
        <GlassBackdrop material="panel" intensity={40} radius={s(20)} />
        <View style={{ width: s(28), height: s(28), borderRadius: s(14), backgroundColor: 'rgba(239, 68, 68, 0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={s(14)} color="#f87171" strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={11} weight="semibold" color="#ffffff" numberOfLines={1}>
            {notice.title}
          </T>
          <T size={9.5} color="rgba(255, 255, 255, 0.75)" numberOfLines={1}>
            {notice.message}
          </T>
        </View>
        <Press
          onPress={onClose}
          sound="back"
          hitSlop={8}
          accessibilityLabel="Đóng thông báo"
          style={{ width: s(20), height: s(20), alignItems: 'center', justifyContent: 'center', borderRadius: s(10), backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
        >
          <X size={s(11)} color="rgba(255, 255, 255, 0.7)" />
        </Press>
      </Press>
    </Animated.View>
  );
}

export default function ConsoleScreen() {
  const styles = useStyles();
  const { s, insets } = useUi();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StoreTab>('games');
  const [panel, setPanel] = useState<LibraryPanel | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storePreviewItem, setStorePreviewItem] = useState<SteamStoreItem | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [storeSearchOpen, setStoreSearchOpen] = useState(false);
  const [selectedStoreItem, setSelectedStoreItem] = useState<SteamStoreItem | null>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<SteamPromotion | null>(null);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory | null>(null);
  const [powerOpen, setPowerOpen] = useState(false);
  const [remoteMenuOpen, setRemoteMenuOpen] = useState(false);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<PcGame | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const rootRef = useRef<View>(null);
  const blurTargetRef = useRef<View>(null);
  const bellRef = useRef<View>(null);
  const remoteAnchorRef = useRef<View>(null);
  const deviceAnchorRef = useRef<View>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const flightBusy = useRef(false);
  const flightResult = useRef<'ok' | 'fail' | null>(null);
  const flightSeq = useRef(0);

  // Ở màn thư viện, tay cầm điều hướng giao diện (không phải PC).
  useCaptureMode('ui');

  const { userId, email } = useSignedInUser();
  const { profile: appProfile } = useUserProfile(userId, email);
  const library = usePcLibrary();
  const { selected } = library;
  const notifications = useNotifications(library.games);
  const [toastNotice, setToastNotice] = useState<{
    id: number;
    title: string;
    message: string;
    gameImageUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!toastNotice) return;
    const timer = setTimeout(() => setToastNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  const onUninstalled = useCallback((appid: number, name?: string | null) => {
    void library.reload(true);
    const game = library.games.find((g) => g.steamAppId === String(appid));
    const gameTitle = name || game?.title || 'Trò chơi Steam';
    const gameImageUrl = game?.artworkUrl || game?.heroUrl || null;
    void notifications.addUninstallNotification({
      appId: appid,
      gameTitle,
      gameImageUrl,
    });
    setToastNotice({
      id: Date.now(),
      title: 'Đã gỡ khỏi máy tính',
      message: `${gameTitle} đã được gỡ cài đặt thành công.`,
      gameImageUrl,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [library, notifications]);

  const deviceStatus = useDeviceStatus();
  const inputDevices = useInputDevices();

  // Control Center ở màn chính (nút View / Select): ô game quay lại game vẫn chạy trên PC sau khi bấm Home.
  const pathname = usePathname();
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [resumable, setResumable] = useState<ResumableGame | null>(readResumableGame);
  useEffect(() => subscribeResumableGame(setResumable), []);
  useGuide(() => setControlCenterOpen((value) => !value), pathname === '/');
  // App bị Android giết khi nằm nền thì đọc lại game đang chơi dở đã lưu.
  useEffect(() => { void hydrateResumableGame(); }, []);
  const resumeGame = useCallback((game: ResumableGame) => {
    setControlCenterOpen(false);
    clearPendingGameLaunch();
    requestStreamResume(game);
    router.push('/stream');
  }, [router]);
  const { sleepPcAndExit, wakePc } = usePcSleepWake(useCallback(() => {
    void library.reload(true);
  }, [library]));
  // Tiến trình tải đi thẳng từ PC qua WebRTC; tải xong thì đọc lại thư viện để hiện Play.
  const downloads = useSteamDownloads(
    userId,
    () => void library.reload(true),
    onUninstalled,
  );
  // Việc Steam đang chờ người bấm Tải trả lời (chọn ổ đĩa, đồng ý điều khoản): tự mở hộp
  // thoại; đóng thì mở lại từ nút "Chọn nơi cài đặt" / "Xem điều khoản".
  const [promptClosed, setPromptClosed] = useState<string | null>(null);
  const promptFlow = downloads.canControl
    ? downloads.state?.installs.find((flow) => flow.phase === 'config' || flow.phase === 'eula') ?? null
    : null;
  const promptKey = promptFlow ? `${promptFlow.phase}:${promptFlow.appid}` : null;
  // Hết việc chờ thì quên lần đóng trước, để lượt cài sau của cùng game lại tự mở.
  if (!promptKey && promptClosed !== null) setPromptClosed(null);
  const promptDownload = promptFlow && promptClosed !== promptKey
    ? downloadForApp(downloads.state, promptFlow.appid)
    : null;
  const configDownload = promptDownload?.status === 'config' ? promptDownload : null;
  const eulaDownload = promptDownload?.status === 'eula' ? promptDownload : null;
  const openPrompt = useCallback(() => { setPromptClosed(null); }, []);
  const profile = useSteamProfile(library.games, library.achievementCache);
  const store = useSteamStore(activeTab === 'store' || storeSearchOpen);
  const storeSearch = useStoreSearch(storeQuery, storeSearchOpen);
  const storeDetail = useStoreGameDetail(selectedStoreItem);
  // Mua game: Steam client trên PC lo thanh toán, app chờ game vào thư viện rồi mời Tải.
  const purchase = useSteamPurchase(() => void library.reload(true));
  const storeOwnership = useStoreOwnership(selectedStoreItem?.appId ?? null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  // Mọi lượt tải để hiện ở tab Tải xuống của thông báo (kèm ảnh game trong thư viện).
  const gamesByAppId = useMemo(() => new Map(library.games.map((game) => [game.steamAppId, game])), [library.games]);
  const downloadItems = useMemo<DownloadItem[]>(() => {
    const gameFor = (appid: number) => gamesByAppId.get(String(appid));
    const list: GameDownload[] = allDownloads(downloads.state);
    const expected = downloads.expectedAppId;
    if (expected && !list.some((entry) => entry.appid === expected)) {
      list.unshift({
        appid: expected, name: gameFor(expected)?.title ?? null, status: 'preparing', label: 'Đang chuẩn bị cài đặt',
        percent: null, downloaded: 0, total: 0, bytesPerSec: 0, etaSec: null, error: null, eulas: null, config: null,
      });
    }
    return list.map((download) => {
      const game = gameFor(download.appid);
      return {
        download: { ...download, name: download.name ?? game?.title ?? null },
        imageUrl: game?.artworkUrl || game?.heroUrl || `https://cdn.cloudflare.steamstatic.com/steam/apps/${download.appid}/header.jpg`,
      };
    });
  }, [downloads.expectedAppId, downloads.state, gamesByAppId]);
  const activeDownloads = useMemo(() => downloadItems.filter((item) => isDownloadActive(item.download)), [downloadItems]);
  const ringPercent = activeDownloads.find((item) => item.download.status === 'downloading' || item.download.status === 'working')?.download.percent ?? null;

  const storeFeatured = store.data?.featured || null;
  const storePreview = storePreviewItem || storeFeatured;
  const storeHero = storePreview?.backgroundImage
    || (storePreview?.appId ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${storePreview.appId}/library_hero.jpg` : null);
  // Reuse the exact shelf image, already decoded/cached when the card is visible.
  const storeBackdropFallback = storePreview?.largeImage || storePreview?.headerImage || storePreview?.smallImage || null;
  const gameHero = selected?.heroUrl
    || (selected?.steamAppId ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${selected.steamAppId}/library_hero.jpg` : null);
  const backdropUrl = activeTab === 'store'
    ? (storeHero || null)
    : activeTab === 'games'
      ? (gameHero || null)
      : null;
  const uninstallAppId = isSteamAppId(uninstallTarget?.steamAppId) ? Number(uninstallTarget.steamAppId) : null;
  const uninstallOperation = uninstallForApp(downloads.state, uninstallAppId) ?? (
    uninstallAppId && downloads.expectedUninstallAppId === uninstallAppId ? {
      appid: uninstallAppId,
      name: uninstallTarget?.title ?? null,
      status: 'starting' as const,
      label: 'Đang khởi động agent gỡ cài đặt',
      progress: 8,
      error: null,
    } : null
  );

  useEffect(() => {
    if (!storeSearchOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [storeSearchOpen]);

  const openStoreGame = useCallback((item: SteamStoreItem) => {
    searchInputRef.current?.blur();
    setPanel(null);
    setMenuOpen(false);
    setSelectedPromotion(null);
    setSelectedStoreItem(item);
  }, []);
  const closeStoreDetail = () => { setSelectedStoreItem(null); setSelectedPromotion(null); };

  const switchTab = useCallback((tab: StoreTab) => {
    if (tab !== activeTab) {
      playUiSound('transition');
      resetFocusToTab();
    }
    setActiveTab(tab);
    setStoreSearchOpen(false);
    setMenuOpen(false);
    setPanel(null);
    setSelectedStoreItem(null);
    setSelectedPromotion(null);
    setRemoteMenuOpen(false);
    setDeviceMenuOpen(false);
  }, [activeTab]);

  const anyOverlay = Boolean(settingsCategory || selectedStoreItem || selectedPromotion || panel || menuOpen || storeSearchOpen || powerOpen || remoteMenuOpen || deviceMenuOpen || uninstallTarget || purchase.visible || controlCenterOpen);

  // Nút B / Back: đóng lớp trên cùng trước. Các panel tự đăng ký Back riêng; ở đây
  // chỉ cần xử lý những lớp do màn này sở hữu (menu, ô tìm kiếm).
  useBack(() => {
    if (deviceMenuOpen) { setDeviceMenuOpen(false); return; }
    if (remoteMenuOpen) { setRemoteMenuOpen(false); return; }
    if (menuOpen) { setMenuOpen(false); return; }
    if (storeSearchOpen) { setStoreSearchOpen(false); searchInputRef.current?.blur(); return; }
    return true;
  }, deviceMenuOpen || remoteMenuOpen || menuOpen || storeSearchOpen);

  // LB/RB đổi giữa Games, Store và PC khi không có lớp nào đang mở.
  useGamepadTabs((direction) => {
    if (anyOverlay) return false;
    const next = STORE_TAB_ORDER[STORE_TAB_ORDER.indexOf(activeTab) + direction];
    if (next) switchTab(next);
  });

  const { selectGame: setSelectedGame } = library;
  const selectGame = useCallback((id: string) => {
    setSelectedGame(id);
    setMenuOpen(false);
    setPanel(null);
  }, [setSelectedGame]);

  const openProfile = () => {
    setMenuOpen(false);
    setPanel('profile');
    void profile.load();
  };

  const openControlCenter = useCallback(() => {
    setMenuOpen(false);
    setRemoteMenuOpen(false);
    setDeviceMenuOpen(false);
    setPanel(null);
    setStoreSearchOpen(false);
    setControlCenterOpen(true);
  }, []);

  const openNotifications = () => {
    setMenuOpen(false);
    setPanel('notifications');
    setSettingsCategory(null);
    setStoreSearchOpen(false);
    void notifications.markAllAsRead();
  };

  // Hiệu ứng thẻ game bay vào chuông: đo thẻ + chuông theo gốc của màn rồi chạy DownloadFlight.
  const startFlight = useCallback(({ imageUrl, from }: { imageUrl: string | null; from: FlightRect }) => {
    if (flightBusy.current) return;
    flightBusy.current = true;
    flightResult.current = null;
    const measure = (node: View | null) => new Promise<FlightRect | null>((resolve) => {
      if (!node) { resolve(null); return; }
      node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
    });
    void Promise.all([measure(rootRef.current), measure(bellRef.current)]).then(([root, bell]) => {
      if (!root || !bell) { flightBusy.current = false; return; }
      const local = (rect: FlightRect): FlightRect => ({ ...rect, x: rect.x - root.x, y: rect.y - root.y });
      flightSeq.current += 1;
      setFlight({ key: flightSeq.current, imageUrl, from: local(from), to: local(bell), result: flightResult.current });
    });
  }, []);
  const resolveFlight = useCallback((ok: boolean) => {
    flightResult.current = ok ? 'ok' : 'fail';
    setFlight((current) => (current ? { ...current, result: flightResult.current } : current));
  }, []);
  const endFlight = useCallback(() => {
    flightBusy.current = false;
    flightResult.current = null;
    setFlight(null);
  }, []);

  // Nút "Chọn" / "Xem" ở thẻ tải trong thông báo: đóng panel và mở lại hộp thoại đang chờ.
  const openDownloadPrompt = () => {
    setPanel(null);
    setPromptClosed(null);
  };

  const openSettings = (category: SettingsCategory) => {
    setMenuOpen(false);
    setPanel(null);
    setStoreSearchOpen(false);
    setSettingsCategory(category);
  };

  // Bấm Play: PC bắt đầu bật booster NGAY, rồi vào màn stream (loading -> game).
  const play = useCallback(async () => {
    if (!library.reachable) { setPowerOpen(true); return; }
    const result = await library.launchSelected();
    if (!result || !selected) return;
    if (result.sessionId) {
      savePendingGameLaunch({
        sessionId: result.sessionId,
        gameId: selected.id,
        title: selected.title,
        heroUrl: selected.heroUrl || selected.artworkUrl || null,
        logoUrl: selected.art?.logoUrl ?? null,
        createdAt: Date.now(),
      });
    }
    router.push('/stream');
  }, [library, router, selected]);

  // Tab PC: stream thẳng desktop, cùng cấu hình stream và đường WebRTC như khi chơi game.
  const connectPc = useCallback(() => {
    if (!library.reachable) { setPowerOpen(true); return; }
    clearPendingGameLaunch();
    router.push('/stream');
  }, [library.reachable, router]);

  const toggleRemoteMenu = useCallback(() => {
    setRemoteMenuOpen((prev) => !prev);
    setDeviceMenuOpen(false);
    setMenuOpen(false);
    setPanel(null);
    setStoreSearchOpen(false);
  }, []);

  const { resync: resyncDevices } = inputDevices;
  const toggleDeviceMenu = useCallback(() => {
    // Native không báo khi pin tụt, nên đọc lại để % pin trong menu là số mới nhất.
    resyncDevices();
    setDeviceMenuOpen((prev) => !prev);
    setRemoteMenuOpen(false);
    setMenuOpen(false);
    setPanel(null);
    setStoreSearchOpen(false);
  }, [resyncDevices]);

  const handleRemoteStream = useCallback(() => {
    setRemoteMenuOpen(false);
    if (!library.reachable) {
      setPowerOpen(true);
      return;
    }
    if (selected) {
      void play();
    } else {
      router.push('/stream');
    }
  }, [library.reachable, play, router, selected]);

  const handleRemoteReload = useCallback(() => {
    void library.reload(true);
  }, [library]);

  const handleRemoteSleep = useCallback(async () => {
    await sleepPcAndExit();
  }, [sleepPcAndExit]);

  const handleRemoteWake = useCallback(() => {
    void wakePc();
  }, [wakePc]);

  const storeOffer = (item: SteamStoreItem): PurchaseOffer => {
    const detail = storeDetail.data?.appId === item.appId ? storeDetail.data : null;
    const portrait = detail?.portraitImage || item.portraitImage || null;
    const header = detail?.headerImage || item.headerImage || item.largeImage || null;
    return {
      appId: item.appId,
      name: detail?.name || item.name,
      imageUrl: portrait || header,
      fallbackImageUrl: header,
      free: detail?.isFree ?? item.finalPrice === 0,
      comingSoon: detail?.comingSoon ?? false,
      currency: detail?.price.currency ?? item.currency,
      original: detail?.price.original ?? item.originalPrice,
      final: detail?.price.final ?? item.finalPrice,
      discountPercent: detail?.price.discountPercent ?? item.discountPercent,
    };
  };

  // PC mở Steam đúng trang rồi chuyển ngay sang stream: người dùng chỉ còn bấm thanh toán trên Steam.
  const checkoutOnSteam = async (target: PurchaseTarget) => {
    if (!library.reachable) { purchase.close(); setPowerOpen(true); return; }
    if (await purchase.checkout(target)) router.push('/stream');
  };

  const installPurchased = async (appId: number) => {
    if (!library.reachable) { setPowerOpen(true); return; }
    setPurchaseNotice(null);
    const result = await library.installGame(`steam-${appId}`);
    if (result.ok) {
      downloads.expect(appId);
      purchase.close();
    } else if (result.error) {
      setPurchaseNotice(result.error);
    }
  };

  // Game đã cài: về kệ game và chọn nó, nút Play đứng sẵn.
  const showInLibrary = (appId: number) => {
    purchase.close();
    switchTab('games');
    library.selectGame(`steam-${appId}`);
  };

  const storeBuyAction = (item: SteamStoreItem, priceLabel: string): StoreBuyAction => {
    const appId = item.appId;
    const shelfGame = library.games.find((game) => game.steamAppId === String(appId));
    const tracked = purchase.state?.offer.appId === appId ? purchase.state : null;
    const installed = shelfGame?.installed === true || storeOwnership?.installed === true || tracked?.installed === true;
    const owned = installed || Boolean(shelfGame) || storeOwnership?.owned === true || tracked?.phase === 'owned';
    const download = downloadForApp(downloads.state, appId);
    if (installed) return { label: 'Chơi', icon: 'play', onPress: () => showInLibrary(appId) };
    if ((download && isDownloadActive(download)) || downloads.expectedAppId === appId) {
      return { label: download?.percent != null ? `Đang tải ${download.percent}%` : 'Đang tải', icon: 'wait', onPress: openNotifications };
    }
    if (owned) {
      return {
        label: library.installingId === `steam-${appId}` ? 'Đang mở Steam' : 'Tải về',
        icon: 'download',
        disabled: Boolean(library.installingId),
        onPress: () => void installPurchased(appId),
      };
    }
    if (tracked && tracked.phase !== 'review') return { label: 'Đang thanh toán', icon: 'wait', onPress: purchase.reopen };
    const offer = storeOffer(item);
    const begin = () => { setPurchaseNotice(null); purchase.begin(offer, storeOwnership); };
    switch (purchaseKind(offer)) {
      case 'unavailable': return { label: 'Sắp ra mắt', icon: 'buy', disabled: true, onPress: () => {} };
      case 'free': return { label: 'Nhận miễn phí', icon: 'free', onPress: begin };
      case 'buy': return { label: 'Mua', price: priceLabel, icon: 'buy', onPress: begin };
    }
  };

  const pressStoreKey = useCallback((key: string) => {
    setStoreQuery((current) => `${current}${key.toLocaleLowerCase('vi')}`.slice(0, 80));
  }, []);
  const eraseStoreKey = useCallback(() => setStoreQuery((current) => Array.from(current).slice(0, -1).join('')), []);
  const submitStoreSearch = useCallback(() => { if (storeSearch.results[0]) openStoreGame(storeSearch.results[0]); }, [openStoreGame, storeSearch.results]);

  const storeContent = useMemo(() => (
    storeSearchOpen ? (
      <StoreSearchPanel query={storeQuery} search={storeSearch} onOpenGame={openStoreGame} onKey={pressStoreKey} onErase={eraseStoreKey} onSubmit={submitStoreSearch} />
    ) : store.loading && !store.data ? (
      <StoreLoading />
    ) : store.error && !store.data ? (
      <StoreError message={store.error} onRetry={() => void store.reload()} />
    ) : store.data && storeFeatured && storePreview ? (
      <StoreHome
        data={store.data}
        featured={storeFeatured}
        preview={storePreview}
        onPreview={setStorePreviewItem}
        onOpenGame={openStoreGame}
        onOpenPromotion={(promotion) => { setSelectedStoreItem(null); setSelectedPromotion(promotion); }}
      />
    ) : !store.data && !store.error ? (
      <StoreLoading />
    ) : (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <T size={12} color="rgba(255,255,255,0.48)">Steam Store chưa có nội dung để hiển thị.</T>
      </View>
    )
  ), [storeSearchOpen, storeQuery, storeSearch, store, storeFeatured, storePreview, openStoreGame, pressStoreKey, eraseStoreKey, submitStoreSearch]);

  const gamesContent = useMemo(() => (
    library.loading && !library.games.length ? (
      <LibrarySkeleton />
    ) : library.games.length ? (
      <GamesView
        library={library}
        downloads={downloads}
        reachable={library.reachable}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onSelectGame={selectGame}
        onPlay={() => void play()}
        onOpenPrompt={openPrompt}
        onInstallStart={startFlight}
        onInstallResult={resolveFlight}
      />
    ) : (
      <LibraryEmpty
        error={library.error}
        warning={library.libraryWarning}
        refreshing={library.refreshing}
        onOpenPc={() => setPowerOpen(true)}
        onRetry={() => void library.reload(true)}
      />
    )
  ), [library, downloads, menuOpen, openPrompt, play, selectGame, startFlight, resolveFlight]);

  const pcContent = useMemo(() => (
    <PcView
      reachable={library.reachable}
      refreshing={library.refreshing || library.loading}
      error={library.error}
      onConnect={connectPc}
    />
  ), [library.reachable, library.refreshing, library.loading, library.error, connectPc]);

  const renderTab = useCallback((tab: StoreTab) => {
    switch (tab) {
      case 'store': return storeContent;
      case 'pc': return pcContent;
      case 'games': default: return gamesContent;
    }
  }, [storeContent, pcContent, gamesContent]);

  return (
    <GlassBlurProvider targetRef={blurTargetRef}>
      <View ref={rootRef} collapsable={false} style={styles.root}>
        <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
          <LibraryBackdrop url={backdropUrl} fallbackUrl={activeTab === 'store' ? storeBackdropFallback : activeTab === 'games' ? selected?.artworkUrl : null} />
          <PcWallpaper visible={activeTab === 'pc'} />
        </BlurTargetView>

        <View
          style={[styles.contentFrame, {
            paddingLeft: s(22) + insets.left,
            paddingRight: s(22) + insets.right,
            paddingTop: s(10) + insets.top,
            paddingBottom: s(12) + insets.bottom,
          }]}
          pointerEvents="box-none"
        >
          <View style={{ height: s(44) }} />
          <ConsoleTabTransition
            activeTab={activeTab}
            renderTab={renderTab}
          />
        </View>

        <View
          pointerEvents="box-none"
          style={[styles.headerFrame, {
            left: s(22) + insets.left,
            right: s(22) + insets.right,
            top: s(10) + insets.top,
          }]}
        >
          {/* Header chỉ giữ màu kính, không blur thật: trên Android mỗi ô kính nhỏ vẫn blur cả
              màn hình mỗi frame (xem GlassBlurProvider), 6 ô là đủ kéo màn chính xuống ~60 fps.
              iOS không đổi: blurTarget chỉ có tác dụng trên Android. */}
          <GlassBlurProvider targetRef={null}>
          <LibraryHeader
          activeTab={activeTab}
          onTabChange={switchTab}
          steamProfile={library.steamProfile}
          onOpenProfile={openProfile}
          onOpenControlCenter={openControlCenter}
          onOpenSettings={openSettings}
          onOpenNotifications={openNotifications}
          unreadCount={notifications.unreadCount}
          notificationCount={notifications.notifications.length + activeDownloads.length}
          downloadCount={activeDownloads.length}
          downloadPercent={ringPercent}
          bellRef={bellRef}
          remoteAnchorRef={remoteAnchorRef}
          remoteMenuOpen={remoteMenuOpen}
          onToggleRemoteMenu={toggleRemoteMenu}
          remoteOnline={deviceStatus.online}
          remoteStage={deviceStatus.stage}
          remoteReachable={library.reachable}
          devices={inputDevices.devices}
          deviceAnchorRef={deviceAnchorRef}
          deviceMenuOpen={deviceMenuOpen}
          onToggleDeviceMenu={toggleDeviceMenu}
          search={(
            <StoreSearchField
              open={storeSearchOpen}
              query={storeQuery}
              inputRef={searchInputRef}
              onOpen={() => setStoreSearchOpen(true)}
              onQueryChange={setStoreQuery}
              onSubmit={submitStoreSearch}
              onClose={() => setStoreSearchOpen(false)}
            />
          )}
          />
          </GlassBlurProvider>
        </View>

      {selectedStoreItem ? (() => {
        const priceLabel = formatStorePrice({ finalPrice: selectedStoreItem.finalPrice, currency: selectedStoreItem.currency });
        return (
          <StoreGameDetail
            item={selectedStoreItem}
            detail={storeDetail.data}
            loading={storeDetail.loading}
            error={storeDetail.error}
            priceLabel={priceLabel}
            buyAction={storeBuyAction(selectedStoreItem, priceLabel)}
            onClose={closeStoreDetail}
          />
        );
      })() : null}

      {selectedPromotion ? (
        <PromotionPanel promotion={selectedPromotion} specials={store.data?.specials || []} onOpenGame={openStoreGame} onClose={closeStoreDetail} />
      ) : null}

      {panel === 'notifications' ? (
        <NotificationsPanel
          notifications={notifications.notifications}
          discounts={notifications.discounts}
          updates={notifications.updates}
          downloads={downloadItems}
          canControlDownloads={downloads.canControl}
          onPauseDownload={downloads.pause}
          onResumeDownload={downloads.resume}
          onOpenDownloadPrompt={openDownloadPrompt}
          onClearAll={notifications.clearAll}
          onClearNotification={notifications.clearNotification}
          loading={notifications.loading}
          error={notifications.error}
          onOpenStoreGame={openStoreGame}
          onSelectGame={(appId) => {
            const game = library.games.find((g) => g.steamAppId === String(appId));
            if (game) selectGame(game.id);
          }}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel === 'profile' ? (
        <SteamProfilePanel state={profile} fallbackProfile={library.steamProfile} onClose={() => setPanel(null)} />
      ) : null}
      {(panel === 'info' || panel === 'news' || panel === 'achievements') && selected ? (
        <GameDetailPanel
          game={selected}
          activeTab={panel}
          onTabChange={setPanel}
          achievementsData={library.achievements.data}
          achievementsLoading={library.achievements.loading}
          achievementsError={library.achievements.error}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {settingsCategory ? (
        <ConsoleSettings initialCategory={settingsCategory} backdropUrl={backdropUrl} onClose={() => setSettingsCategory(null)} />
      ) : null}

      {configDownload ? (
        <InstallConfigSheet
          key={configDownload.appid}
          download={configDownload}
          imageUrl={downloadItems.find((item) => item.download.appid === configDownload.appid)?.imageUrl ?? null}
          notice={downloads.notice}
          onClose={() => setPromptClosed(promptKey)}
          onAnswer={(answer) => {
            downloads.answerConfig(configDownload.appid, answer);
            setPromptClosed(promptKey);
          }}
        />
      ) : null}

      {eulaDownload ? (
        <EulaSheet
          download={eulaDownload}
          onClose={() => setPromptClosed(promptKey)}
          onAnswer={(accept) => {
            downloads.answerEula(eulaDownload.appid, accept);
            setPromptClosed(promptKey);
          }}
        />
      ) : null}

      {purchase.state && purchase.visible ? (
        <PurchaseSheet
          key={purchase.state.offer.appId}
          state={purchase.state}
          installing={library.installingId === `steam-${purchase.state.offer.appId}`}
          notice={purchaseNotice}
          onCheckout={(target) => void checkoutOnSteam(target)}
          onOpenStream={() => router.push('/stream')}
          onInstall={() => void installPurchased(purchase.state!.offer.appId)}
          onPlay={() => showInLibrary(purchase.state!.offer.appId)}
          onRecheck={purchase.recheck}
          onBack={purchase.back}
          onClose={purchase.close}
        />
      ) : null}

      {flight ? <DownloadFlight key={flight.key} flight={flight} onDone={endFlight} /> : null}

      {powerOpen ? (
        <PcPowerSheet
          onClose={() => setPowerOpen(false)}
          onReady={() => { setPowerOpen(false); void library.reload(true); }}
        />
      ) : null}

      {uninstallTarget && uninstallAppId ? (
        <UninstallSheet
          key={uninstallTarget.id}
          game={uninstallTarget}
          operation={uninstallOperation}
          requesting={library.uninstallingId === uninstallTarget.id}
          notice={downloads.notice}
          onClose={() => setUninstallTarget(null)}
          onConfirm={async () => {
            const result = await library.uninstallGame(uninstallTarget.id);
            if (result.ok) downloads.expectUninstall(uninstallAppId);
            return result;
          }}
        />
      ) : null}

      {menuOpen && selected ? (
        <GameOptionsModal
          game={selected}
          uninstalling={Boolean(uninstallOperation && uninstallOperation.status !== 'failed' && uninstallOperation.status !== 'uninstalled')}
          onClose={() => setMenuOpen(false)}
          onOpenPanel={(panel) => {
            setMenuOpen(false);
            setPanel(panel);
          }}
          onUninstall={() => {
            setMenuOpen(false);
            setUninstallTarget(selected);
          }}
        />
      ) : null}

      {toastNotice ? (
        <ToastNotification
          notice={toastNotice}
          onPress={() => {
            setToastNotice(null);
            openNotifications();
          }}
          onClose={() => setToastNotice(null)}
        />
      ) : null}

      <RemoteConnectionMenu
        open={remoteMenuOpen}
        anchorRef={remoteAnchorRef}
        onClose={() => setRemoteMenuOpen(false)}
        online={deviceStatus.online}
        stage={deviceStatus.stage}
        reachable={library.reachable}
        refreshing={library.refreshing}
        onStream={handleRemoteStream}
        onReload={handleRemoteReload}
        onSleep={handleRemoteSleep}
        onWake={handleRemoteWake}
      />

        <DeviceConnectionMenu
          open={deviceMenuOpen}
          anchorRef={deviceAnchorRef}
          devices={inputDevices.devices}
          onClose={() => setDeviceMenuOpen(false)}
          onOpenSettings={() => openSettings('devices')}
        />

        <HomeControlCenter
          open={controlCenterOpen}
          game={resumable}
          profile={{ name: appProfile.displayName, avatarUrl: appProfile.avatarUrl, email: appProfile.email }}
          devices={inputDevices.devices}
          notifications={notifications.notifications}
          unreadCount={notifications.unreadCount}
          onMarkAllRead={() => void notifications.markAllAsRead()}
          onResume={resumeGame}
          onClose={() => setControlCenterOpen(false)}
        />

        {!controlCenterOpen ? (
          <VirtualKeyboard
            onLocalText={(ch) => {
              if (!storeSearchOpen && activeTab === 'store') setStoreSearchOpen(true);
              pressStoreKey(ch);
            }}
            onLocalBackspace={eraseStoreKey}
            onLocalSubmit={submitStoreSearch}
            onLocalEscape={() => setStoreSearchOpen(false)}
          />
        ) : null}
      </View>
    </GlassBlurProvider>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, overflow: 'hidden', backgroundColor: CONSOLE.background },
  contentFrame: { flex: 1 },
  headerFrame: { position: 'absolute', zIndex: 30, elevation: 30 },
}));
