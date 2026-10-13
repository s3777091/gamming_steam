// Màn chính của app: tab Games (kệ game trên PC) và tab Store (Steam), cài đặt,
// hồ sơ Steam. Bản native của components/MobileVersionSelector.tsx — cùng bố cục
// ngang, cùng thao tác, cùng dữ liệu.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useSignedInUser } from '@/features/auth';
import { useBack, useGamepadTabs } from '@/features/gamepad/hooks';
import { useCaptureMode } from '@/features/gamepad/captureMode';
import { formatStorePrice, isSteamAppId } from '@/features/library/format';
import type { DownloadItem } from '@/features/library/DownloadNotificationCard';
import { GameAchievementsPanel, GameInfoPanel, GameNewsPanel } from '@/features/library/GamePanels';
import { NotificationsPanel } from '@/features/library/NotificationsPanel';
import { PromotionPanel, SteamProfilePanel } from '@/features/library/ProfilePanels';
import type { LibraryPanel, SteamPromotion, SteamStoreItem, StoreTab } from '@/features/library/types';
import { useNotifications } from '@/features/library/useNotifications';
import { usePcLibrary } from '@/features/library/usePcLibrary';
import { useSteamDownloads } from '@/features/library/useSteamDownloads';
import { useSteamPurchase, useStoreOwnership } from '@/features/library/useSteamPurchase';
import { useSteamProfile } from '@/features/library/useSteamProfile';
import { useSteamStore, useStoreGameDetail, useStoreSearch } from '@/features/library/useSteamStore';
import { useDeviceStatus } from '@/features/devices/useDeviceStatus';
import ConsoleSettings, { type SettingsCategory } from '@/features/settings/ConsoleSettings';
import { savePendingGameLaunch } from '@/lib/game-launch';
import { type GameDownload, allDownloads, downloadForApp, isDownloadActive } from '@/lib/steam-downloads';
import { type PurchaseOffer, type PurchaseTarget, purchaseKind } from '@/lib/steam-purchase';
import { useUi } from '@/ui/scale';

import { type Flight, type FlightRect, DownloadFlight } from './DownloadFlight';
import { EulaSheet } from './DownloadViews';
import { GamesView } from './GamesView';
import { InstallConfigSheet } from './InstallConfigSheet';
import { LibraryHeader } from './LibraryHeader';
import { LibraryBackdrop, LibraryEmpty, LibrarySkeleton, StoreError, StoreLoading } from './LibraryStates';
import { PcPowerSheet } from './PcPowerSheet';
import { PurchaseSheet } from './PurchaseSheet';
import { RemoteConnectionMenu } from './RemoteConnectionMenu';
import { usePcSleepWake } from './usePcSleepWake';
import { type StoreBuyAction, StoreGameDetail } from './StoreGameDetail';
import { StoreHome } from './StoreHome';
import { StoreSearchField, StoreSearchPanel } from './StoreSearch';
import { T } from '@/ui/Text';

export default function ConsoleScreen() {
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
  const searchInputRef = useRef<TextInput>(null);
  const rootRef = useRef<View>(null);
  const bellRef = useRef<View>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const flightBusy = useRef(false);
  const flightResult = useRef<'ok' | 'fail' | null>(null);
  const flightSeq = useRef(0);

  // Ở màn thư viện, tay cầm điều hướng giao diện (không phải PC).
  useCaptureMode('ui');

  const { userId } = useSignedInUser();
  const library = usePcLibrary();
  const { selected } = library;
  const deviceStatus = useDeviceStatus();
  const { sleepPcAndExit, wakePc } = usePcSleepWake(useCallback(() => {
    void library.reload(true);
  }, [library]));
  // Tiến trình tải đi thẳng từ PC qua WebRTC; tải xong thì đọc lại thư viện để hiện Play.
  const downloads = useSteamDownloads(userId, () => void library.reload(true));
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
  const store = useSteamStore(activeTab === 'store');
  const storeSearch = useStoreSearch(storeQuery, storeSearchOpen);
  const storeDetail = useStoreGameDetail(selectedStoreItem);
  const notifications = useNotifications(library.games);
  // Mua game: Steam client trên PC lo thanh toán, app chờ game vào thư viện rồi mời Tải.
  const purchase = useSteamPurchase(() => void library.reload(true));
  const storeOwnership = useStoreOwnership(selectedStoreItem?.appId ?? null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  // Mọi lượt tải để hiện ở tab Tải xuống của thông báo (kèm ảnh game trong thư viện).
  const downloadItems = useMemo<DownloadItem[]>(() => {
    const gameFor = (appid: number) => library.games.find((game) => game.steamAppId === String(appid));
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
  }, [downloads.expectedAppId, downloads.state, library.games]);
  const activeDownloads = downloadItems.filter((item) => isDownloadActive(item.download));
  const ringPercent = activeDownloads.find((item) => item.download.status === 'downloading' || item.download.status === 'working')?.download.percent ?? null;

  const storeFeatured = store.data?.featured || null;
  const storePreview = storePreviewItem || storeFeatured;
  const backdropUrl = activeTab === 'store'
    ? storePreview?.backgroundImage || storePreview?.headerImage
    : selected?.heroUrl;
  const selectedAppId = isSteamAppId(selected?.steamAppId) ? Number(selected.steamAppId) : null;

  useEffect(() => {
    if (!storeSearchOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [storeSearchOpen]);

  const openStoreGame = (item: SteamStoreItem) => {
    searchInputRef.current?.blur();
    setSelectedPromotion(null);
    setSelectedStoreItem(item);
  };
  const closeStoreDetail = () => { setSelectedStoreItem(null); setSelectedPromotion(null); };

  const switchTab = useCallback((tab: StoreTab) => {
    setActiveTab(tab);
    setStoreSearchOpen(false);
    setMenuOpen(false);
    setPanel(null);
    setSelectedStoreItem(null);
    setSelectedPromotion(null);
    setRemoteMenuOpen(false);
  }, []);

  const anyOverlay = Boolean(settingsCategory || selectedStoreItem || selectedPromotion || panel || menuOpen || storeSearchOpen || powerOpen || remoteMenuOpen || purchase.visible);

  // Nút B / Back: đóng lớp trên cùng trước. Các panel tự đăng ký Back riêng; ở đây
  // chỉ cần xử lý những lớp do màn này sở hữu (menu, ô tìm kiếm).
  useBack(() => {
    if (remoteMenuOpen) { setRemoteMenuOpen(false); return; }
    if (menuOpen) { setMenuOpen(false); return; }
    if (storeSearchOpen) { setStoreSearchOpen(false); searchInputRef.current?.blur(); return; }
    return true;
  }, remoteMenuOpen || menuOpen || storeSearchOpen);

  // LB/RB đổi giữa Games và Store khi không có lớp nào đang mở.
  useGamepadTabs((direction) => {
    if (anyOverlay) return false;
    switchTab(direction < 0 ? 'games' : 'store');
  });

  const selectGame = (id: string) => {
    library.selectGame(id);
    setMenuOpen(false);
    setPanel(null);
  };

  const openProfile = () => {
    setMenuOpen(false);
    setPanel('profile');
    void profile.load();
  };

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
  const play = async () => {
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
  };

  const toggleRemoteMenu = useCallback(() => {
    setRemoteMenuOpen((prev) => !prev);
    setMenuOpen(false);
    setPanel(null);
    setStoreSearchOpen(false);
  }, []);

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
  }, [library.reachable, router, selected]);

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
    return {
      appId: item.appId,
      name: detail?.name || item.name,
      imageUrl: detail?.portraitImage || item.portraitImage || detail?.headerImage || item.headerImage || null,
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

  const pressStoreKey = (key: string) => {
    setStoreQuery((current) => `${current}${key.toLocaleLowerCase('vi')}`.slice(0, 80));
  };
  const eraseStoreKey = () => setStoreQuery((current) => Array.from(current).slice(0, -1).join(''));
  const submitStoreSearch = () => { if (storeSearch.results[0]) openStoreGame(storeSearch.results[0]); };

  const storeContent = storeSearchOpen ? (
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
  ) : (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <T size={12} color="rgba(255,255,255,0.48)">Steam Store chưa có nội dung để hiển thị.</T>
    </View>
  );

  const gamesContent = library.loading && !library.games.length ? (
    <LibrarySkeleton />
  ) : library.games.length ? (
    <GamesView
      library={library}
      downloads={downloads}
      reachable={library.reachable}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onSelectGame={selectGame}
      onOpenPanel={setPanel}
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
  );

  return (
    <View ref={rootRef} collapsable={false} style={styles.root}>
      <LibraryBackdrop url={backdropUrl} store={activeTab === 'store'} />

      <View
        style={{
          flex: 1,
          zIndex: 1,
          paddingLeft: s(22) + insets.left,
          paddingRight: s(22) + insets.right,
          paddingTop: s(10) + insets.top,
          paddingBottom: s(12) + insets.bottom,
        }}
      >
        <LibraryHeader
          activeTab={activeTab}
          onTabChange={switchTab}
          steamProfile={library.steamProfile}
          onOpenProfile={openProfile}
          onOpenSettings={openSettings}
          onOpenNotifications={openNotifications}
          unreadCount={notifications.unreadCount}
          downloadCount={activeDownloads.length}
          downloadPercent={ringPercent}
          bellRef={bellRef}
          remoteMenuOpen={remoteMenuOpen}
          onToggleRemoteMenu={toggleRemoteMenu}
          remoteOnline={deviceStatus.online}
          remoteStage={deviceStatus.stage}
          remoteReachable={library.reachable}
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
        {activeTab === 'store' ? storeContent : gamesContent}
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
          loading={notifications.loading}
          error={notifications.error}
          onOpenStoreGame={openStoreGame}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel === 'profile' ? <SteamProfilePanel state={profile} onClose={() => setPanel(null)} /> : null}
      {panel === 'info' && selected ? <GameInfoPanel game={selected} onClose={() => setPanel(null)} /> : null}
      {panel === 'news' && selected && selectedAppId !== null ? (
        <GameNewsPanel key={selectedAppId} appId={selectedAppId} gameTitle={selected.title} onClose={() => setPanel(null)} />
      ) : null}
      {panel === 'achievements' && selected && selectedAppId !== null ? (
        <GameAchievementsPanel
          gameTitle={selected.title}
          data={library.achievements.data}
          loading={library.achievements.loading}
          error={library.achievements.error}
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

      <RemoteConnectionMenu
        open={remoteMenuOpen}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#080c12' },
});
