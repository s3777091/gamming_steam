import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Animated, Easing, FlatList, Platform, StyleSheet, View, type ListRenderItemInfo, type ScrollViewProps } from 'react-native';
import { FocusScroll, useSceneActive } from '@/features/gamepad/focus';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, Ellipsis, FileText, HardDrive, Monitor, Pause, Play, Trash2, Trophy } from 'lucide-react-native';

import { isSteamAppId } from '@/features/library/format';
import type { PcGame } from '@/features/library/types';
import type { PcLibrary } from '@/features/library/usePcLibrary';
import type { SteamDownloads } from '@/features/library/useSteamDownloads';
import { type GameDownload, type GameUninstall, downloadForApp, primaryDownload, uninstallForApp } from '@/lib/steam-downloads';
import { shelfItemLayout } from '@/lib/game-shelf-layout';
import { nearbyBackdropUrls } from '@/lib/backdrop-preloader';
import { alpha, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useBackdropPreload } from '@/ui/useBackdropPreload';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { DownloadStatusLine, ProgressRing, downloadInProgress } from './DownloadViews';
import type { FlightRect } from './DownloadFlight';
import { CONSOLE, CONSOLE_CARD } from './consoleVisuals';
import { ConsoleAction, ConsoleHints } from './ConsoleControls';
import { useConsoleRailScroll } from './useConsoleRailScroll';

const GameTitle = memo(function GameTitle({ game }: { game: PcGame }) {
  const { s, width, height } = useUi();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logoUrl = game.art?.logoUrl && game.art.logoUrl !== failedLogo ? game.art.logoUrl : null;
  const maxHeight = Math.min(s(90), height * 0.17);
  const maxWidth = Math.min(s(292), width * 0.34);
  const ratio = game.art?.logoWidth && game.art?.logoHeight ? game.art.logoWidth / game.art.logoHeight : 2.4;
  const logoWidth = Math.min(maxWidth, maxHeight * ratio);

  return (
    <View style={{ flexShrink: 1 }}>
      {logoUrl ? (
        <Img
          source={{ uri: logoUrl }}
          accessibilityLabel={game.title}
          style={{ width: logoWidth, height: logoWidth / ratio }}
          contentFit="contain"
          contentPosition="left"
          transition={0}
          onError={() => setFailedLogo(logoUrl)}
        />
      ) : (
        <T size={Math.min(42, Math.max(28, width * 0.043 / 1.4))} weight="semibold" color={CONSOLE.ink} tracking={-0.04} leading={1.1} numberOfLines={2}>
          {game.title}
        </T>
      )}
    </View>
  );
});

function primaryActionState({ library, download, uninstall, reachable }: {
  library: PcLibrary;
  download: GameDownload | null;
  uninstall: GameUninstall | null;
  reachable: boolean;
}) {
  const { selected, launchingId, installingId } = library;
  const installed = selected?.installed !== false;
  // Đang tải: nút thành vòng tiến trình; bấm để tạm dừng/tiếp tục hoặc xem điều khoản.
  const tracking = reachable && !installed && downloadInProgress(download) ? download : null;
  const uninstalling = uninstall && uninstall.status !== 'failed' && uninstall.status !== 'uninstalled' ? uninstall : null;
  const label = uninstalling ? uninstalling.label : tracking ? tracking.label
    : !reachable ? 'Mở máy tính' : installed ? (launchingId ? 'Đang mở' : 'Chơi') : installingId ? 'Đang mở Steam' : 'Cài đặt';
  const busy = Boolean(launchingId || installingId || library.uninstallingId || uninstalling)
    || Boolean(tracking && ['preparing', 'working', 'queued', 'installed'].includes(tracking.status));
  return { installed, tracking, uninstalling, label, disabled: tracking ? false : busy };
}

function PrimaryAction({ action, canControl, reachable, onPress }: {
  action: ReturnType<typeof primaryActionState>;
  canControl: boolean;
  reachable: boolean;
  onPress: () => void;
}) {
  const { s } = useUi();
  const { installed, tracking, uninstalling, label, disabled } = action;
  return (
    <ConsoleAction
      label={label}
      onPress={onPress}
      disabled={disabled}
      autoFocus
      icon={<View style={{ width: s(26), height: s(26), alignItems: 'center', justifyContent: 'center' }}>
          {uninstalling ? <ProgressRing size={s(26)} percent={uninstalling.progress} /> : tracking ? <ProgressRing size={s(26)} percent={tracking.percent} /> : null}
            {uninstalling ? (
              <Trash2 size={s(14)} color={CONSOLE.ink} />
            ) : tracking ? (
              tracking.status === 'eula' ? <FileText size={s(13)} color={CONSOLE.ink} />
                : tracking.status === 'config' ? <HardDrive size={s(13)} color={CONSOLE.ink} />
                : tracking.status === 'downloading' && canControl ? <Pause size={s(12)} color={CONSOLE.ink} fill={CONSOLE.ink} />
                  : <Download size={s(13)} color={CONSOLE.ink} />
            ) : !reachable ? (
              <Monitor size={s(18)} color={CONSOLE.ink} />
            ) : installed ? (
              <Play size={s(17)} color={CONSOLE.ink} fill={CONSOLE.ink} style={{ marginLeft: s(2) }} />
            ) : (
              <Download size={s(18)} color={CONSOLE.ink} />
            )}
      </View>}
    />
  );
}

/** Nút (…) cạnh Play: mở bảng tùy chọn game phong cách Console. */
function GameMoreButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { s } = useUi();
  const size = s(44);
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Tùy chọn game"
      focusVariant="quiet"
      style={[
        styles.more,
        {
          width: size,
          height: size,
          borderRadius: s(12),
          borderColor: active ? CONSOLE.selectedBorder : CONSOLE.border,
          backgroundColor: CONSOLE.control,
        },
      ]}
    >
      <Ellipsis size={s(16)} color={active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
    </Press>
  );
}

// Every thumbnail shares a 16:9 footprint; selection only scales its artwork 5%.
const CARD = { w: CONSOLE_CARD.width, h: CONSOLE_CARD.height };
const GAP = 12;
// Vạch đứng ngăn game đã cài (bên trái) với game chưa cài (bên phải).
const DIVIDER = { w: 1, h: 48 };

// Keep gamepad scroll ancestry intact inside FlatList's virtualized cells.
function renderFocusRail(props: ScrollViewProps) {
  return <FocusScroll {...props} />;
}

const gameKey = (game: PcGame) => game.id;

function ShelfDivider() {
  const { s } = useUi();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['transparent', CONSOLE.border, 'transparent']}
      style={{ width: s(DIVIDER.w), height: s(DIVIDER.h), borderRadius: s(DIVIDER.w) }}
    />
  );
}

const GameCard = memo(function GameCard({ game, active, onSelect, onActivate, cardRef }: {
  game: PcGame;
  active: boolean;
  onSelect: (id: string) => void;
  onActivate: () => void;
  /** Gắn vào thẻ đang chọn: điểm xuất phát của hiệu ứng thẻ bay vào thông báo. */
  cardRef: RefObject<View | null>;
}) {
  const styles = useStyles();
  const { s } = useUi();
  const select = useCallback(() => onSelect(game.id), [game.id, onSelect]);
  const { reduceMotion } = useMotion();
  const previousActive = useRef(active);
  const [selection] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    const changed = previousActive.current !== active;
    previousActive.current = active;
    if (reduceMotion) { selection.setValue(active ? 1 : 0); return; }
    if (!changed) { selection.setValue(active ? 1 : 0); return; }
    const animation = Animated.timing(selection, {
      toValue: active ? 1 : 0,
      duration: CONSOLE.focusMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, selection]);

  const [failedArt, setFailedArt] = useState<string | null>(null);
  const artwork = game.artworkUrl && game.artworkUrl !== failedArt ? game.artworkUrl : null;
  return (
      <Animated.View
        ref={active ? cardRef : undefined}
        collapsable={false}
        style={[
          {
            width: s(CARD.w), height: s(CARD.h),
            transform: [
              { scale: selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
            ],
          },
        ]}
      >
        <Press onPress={active ? onActivate : select} onFocused={select} onFocus={select}
          focusRadius={s(10)} focusVariant="quiet" focusScale={1} pressScale={0.98}
          accessibilityLabel={game.title} accessibilityState={{ selected: active }}
          accessibilityHint={active ? 'Nhấn để chơi hoặc cài đặt game' : 'Nhấn để chọn game'}
          style={{ width: '100%', height: '100%', borderRadius: s(10) }}>
          <Animated.View style={[styles.card, { width: '100%', height: '100%', borderRadius: s(10),
            borderColor: active ? CONSOLE.selectedBorder : CONSOLE.border,
            opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }]}>
            {artwork ? <Img source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} onError={() => setFailedArt(artwork)} /> : (
              <View style={{ flex: 1, justifyContent: 'flex-end', padding: s(10) }}>
                <T size={12} weight="semibold" color={CONSOLE.ink} numberOfLines={2}>{game.title}</T>
              </View>
            )}
          </Animated.View>
        </Press>
      </Animated.View>
  );
});

/** Tab Games: logo + nút của game đang chọn, phía dưới là kệ mọi game trên PC. */
export const GamesView = memo(function GamesView({ library, downloads, reachable, menuOpen, onMenuOpenChange, onSelectGame, onPlay, onOpenPrompt, onInstallStart, onInstallResult }: {
  library: PcLibrary;
  downloads: SteamDownloads;
  reachable: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSelectGame: (id: string) => void;
  onPlay: () => void;
  /** Mở hộp thoại Steam đang chờ trả lời (chọn nơi cài đặt hoặc điều khoản). */
  onOpenPrompt: () => void;
  /** Bấm Tải: thẻ game thu vào ô nhỏ rồi chờ kết quả (xem DownloadFlight). */
  onInstallStart: (info: { imageUrl: string | null; from: FlightRect }) => void;
  onInstallResult: (ok: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { s } = useUi();
  const { active: appActive, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  const [details] = useState(() => new Animated.Value(1));
  const activeCard = useRef<View>(null);
  const { games, selected, error, installOpenedId } = library;
  const selectedId = selected?.id;
  useLayoutEffect(() => {
    details.setValue(reduceMotion || !appActive || !sceneActive ? 1 : 0);
    const animation = Animated.timing(details, {
      toValue: 1, duration: reduceMotion || !appActive || !sceneActive ? 0 : CONSOLE.infoMs,
      easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [appActive, details, reduceMotion, sceneActive, selectedId]);
  const selectedAppId = isSteamAppId(selected?.steamAppId) ? Number(selected.steamAppId) : null;
  const tracked = downloadForApp(downloads.state, selectedAppId);
  const trackedUninstall = uninstallForApp(downloads.state, selectedAppId);
  const uninstall: GameUninstall | null = trackedUninstall ?? (
    selectedAppId && downloads.expectedUninstallAppId === selectedAppId ? {
      appid: selectedAppId,
      name: selected?.title ?? null,
      status: 'starting',
      label: 'Đang khởi động agent gỡ cài đặt',
      progress: 8,
      error: null,
    } : null
  );
  // PC đã nhận lệnh cài nhưng agent chưa kịp báo: hiện "đang chuẩn bị" ngay.
  const download: GameDownload | null = tracked ?? (selectedAppId && downloads.expectedAppId === selectedAppId ? {
    appid: selectedAppId, name: selected?.title ?? null, status: 'preparing', label: 'Đang chuẩn bị cài đặt',
    percent: null, downloaded: 0, total: 0, bytesPerSec: 0, etaSec: null, error: null, eulas: null, config: null,
  } : null);
  const elsewhere = download ? null : primaryDownload(downloads.state);
  const showDownload = Boolean(download && selected?.installed === false);

  const install = async () => {
    if (library.installingId) return;
    // Đo thẻ đang chọn để hiệu ứng bắt đầu đúng chỗ; đo không được thì vẫn cài bình thường.
    const from = await new Promise<FlightRect | null>((resolve) => {
      const node = activeCard.current;
      if (!node) { resolve(null); return; }
      node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
    });
    if (from) onInstallStart({ imageUrl: selected?.artworkUrl || selected?.heroUrl || null, from });
    const ok = await library.installSelected();
    if (ok && selectedAppId) downloads.expect(selectedAppId);
    if (from) onInstallResult(ok);
  };
  const onDownloadPress = () => {
    if (!download) return;
    if (download.status === 'eula' || download.status === 'config') onOpenPrompt();
    else if (!downloads.canControl) return;
    else if (download.status === 'downloading') downloads.pause(download.appid);
    else if (download.status === 'paused') downloads.resume(download.appid);
  };
  const action = primaryActionState({ library, download, uninstall, reachable });
  const activateSelected = () => {
    if (action.disabled) return;
    if (action.tracking) onDownloadPress();
    else if (!reachable || action.installed) onPlay();
    else void install();
  };
  const activateRef = useRef(activateSelected);
  useLayoutEffect(() => { activateRef.current = activateSelected; });
  const activateFromShelf = useCallback(() => activateRef.current(), []);
  const achievements = library.achievements.data;
  const achievementText = achievements?.supported && achievements.total
    ? `${achievements.unlocked ?? 0}/${achievements.total} thành tích · ${Math.round(((achievements.unlocked ?? 0) / achievements.total) * 100)}%`
    : null;
  const metadata = selected?.genres?.length ? selected.genres.slice(0, 3).join(' · ')
    : [selected?.source, selected?.installed === false ? 'Chưa cài đặt' : 'Đã cài đặt'].filter(Boolean).join(' · ');

  return (
    <View style={{ flex: 1 }}>
      <FocusScroll style={{ flex: 1, zIndex: 40 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: s(10), paddingTop: s(8), paddingHorizontal: s(10) }}>
        <Animated.View pointerEvents="box-none" style={{ alignItems: 'flex-start', gap: s(10), opacity: details,
          transform: [{ translateY: details.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : s(8), 0] }) }] }}>
          {selected ? <GameTitle game={selected} /> : null}
          {selected ? <T size={11} color={CONSOLE.muted} numberOfLines={1} style={{ maxWidth: s(380) }}>{metadata}</T> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), zIndex: 40 }}>
            <PrimaryAction
              action={action}
              canControl={downloads.canControl}
              onPress={activateSelected}
              reachable={reachable}
            />
            {selected ? (
              <GameMoreButton
                active={menuOpen}
                onPress={() => onMenuOpenChange(!menuOpen)}
              />
            ) : null}
          </View>
          {achievementText && !error && !showDownload && !uninstall ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
              <Trophy size={s(13)} color={CONSOLE.muted} strokeWidth={1.7} />
              <T size={10} color={CONSOLE.muted} tabular>{achievementText}</T>
            </View>
          ) : null}
        </Animated.View>

        {error ? (
          <View style={[styles.error, { marginTop: s(10), maxWidth: s(480), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(6) }]}>
            <T size={10.4} color="#fee2e2" leading={1.5}>{error}</T>
          </View>
        ) : null}
        {!error && showDownload && download ? (
          <DownloadStatusLine download={download} canControl={downloads.canControl} onOpenEula={onOpenPrompt} />
        ) : null}
        {!error && uninstall && uninstall.status !== 'uninstalled' ? (
          <View style={{ marginTop: s(10), maxWidth: s(460), gap: s(6) }}>
            <T size={10.4} weight="medium" color={uninstall.status === 'failed' ? '#fecaca' : 'rgba(255,255,255,0.78)'} numberOfLines={1}>
              {uninstall.error || uninstall.label}
            </T>
            {uninstall.status !== 'failed' ? (
              <View style={[styles.uninstallTrack, { height: s(3), borderRadius: s(2) }]}>
                <View style={{ width: `${uninstall.progress}%`, height: '100%', borderRadius: s(2), backgroundColor: colors.accent }} />
              </View>
            ) : null}
          </View>
        ) : null}
        {!error && !showDownload && elsewhere && downloadInProgress(elsewhere) ? (
          <T size={10.4} weight="medium" color="rgba(255,255,255,0.6)" tabular numberOfLines={1} style={{ marginTop: s(10) }}>
            {[`${elsewhere.label} ${elsewhere.name ?? 'một game'}`, elsewhere.percent !== null ? `${elsewhere.percent}%` : null].filter(Boolean).join(' · ')}
          </T>
        ) : null}
        {!error && downloads.notice ? (
          <T size={10} color={colors.text3} style={{ marginTop: s(6) }}>{downloads.notice}</T>
        ) : null}
        {!error && selected && selected.installed === false && (installOpenedId === selected.id || download?.status === 'preparing') ? (
          <View style={[styles.remoteConfirmBanner, { marginTop: s(10), padding: s(10), borderRadius: s(14), maxWidth: s(480) }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <HardDrive size={s(15)} color={colors.accent} strokeWidth={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={10.5} weight="semibold" color="#ffffff">
                  Vui lòng chọn ổ đĩa trên máy tính và xác nhận tải
                </T>
                <T size={9.5} color="rgba(255,255,255,0.7)" style={{ marginTop: s(2) }}>
                  Steam đã mở hộp thoại cài đặt trên máy. Bạn có thể mở màn hình để xác nhận ngay.
                </T>
              </View>
              <Press
                onPress={() => router.push('/stream')}
                sound="confirm"
                style={[styles.streamConfirmButton, { height: s(28), paddingHorizontal: s(12), borderRadius: s(14) }]}
              >
                <Monitor size={s(12)} color={colors.onAccent} />
                <T size={10} weight="bold" color={colors.onAccent}>Xem máy</T>
              </Press>
            </View>
          </View>
        ) : null}
      </FocusScroll>

      <GameShelf
        games={games}
        selectedId={selected?.id ?? null}
        activeCard={activeCard}
        onSelectGame={onSelectGame}
        onActivate={activateFromShelf}
      />
      <ConsoleHints actionLabel={action.tracking ? 'Quản lý tải' : !reachable ? 'Mở PC' : action.installed ? 'Chơi' : 'Cài đặt'} />
    </View>
  );
});

/** Download progress never invalidates the virtualized game shelf. */
const GameShelf = memo(function GameShelf({ games, selectedId, activeCard, onSelectGame, onActivate }: {
  games: PcGame[];
  selectedId: string | null;
  activeCard: RefObject<View | null>;
  onSelectGame: (id: string) => void;
  onActivate: () => void;
}) {
  const { s, width, insets } = useUi();
  const estimatedRailWidth = Math.max(100, width - (s(44) + insets.left + insets.right));
  const rail = useRef<FlatList<PcGame>>(null);
  const railWidth = useRef(estimatedRailWidth);
  const scrollTo = useCallback((offset: number) => rail.current?.scrollToOffset({ offset, animated: false }), []);
  const { center: scrollCenter, stop: stopScroll, onScroll } = useConsoleRailScroll(scrollTo);
  // Game đã cài đứng trước, game chưa cài đứng sau vạch ngăn; thứ tự trong mỗi nhóm giữ nguyên.
  const shelf = useMemo(() => {
    const installed = games.filter((game) => game.installed !== false);
    const missing = games.filter((game) => game.installed === false);
    return { ordered: [...installed, ...missing], installedCount: installed.length, hasDivider: installed.length > 0 && missing.length > 0 };
  }, [games]);
  const selectedIndex = Math.max(0, shelf.ordered.findIndex((game) => game.id === selectedId));
  const heroUrls = useMemo(() => shelf.ordered.map((game) => game.heroUrl || (game.steamAppId
    ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${game.steamAppId}/library_hero.jpg` : null)), [shelf.ordered]);
  const preloadUrls = useMemo(() => nearbyBackdropUrls(heroUrls, selectedIndex), [heroUrls, selectedIndex]);
  useBackdropPreload(preloadUrls);
  const metrics = useMemo(() => ({
    idleWidth: s(CARD.w), activeWidth: s(CARD.w), gap: s(GAP), dividerWidth: s(DIVIDER.w), padding: s(10),
  }), [s]);
  const dividerIndex = shelf.hasDivider ? shelf.installedCount : null;
  const getItemLayout = useCallback((_data: ArrayLike<PcGame> | null | undefined, index: number) => (
    shelfItemLayout(index, selectedIndex, dividerIndex, metrics)
  ), [dividerIndex, metrics, selectedIndex]);
  const renderGame = useCallback(({ item: game, index }: ListRenderItemInfo<PcGame>) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: metrics.gap, marginRight: metrics.gap }}>
      {index === dividerIndex ? <ShelfDivider /> : null}
      <GameCard
        game={game}
        active={game.id === selectedId}
        onSelect={onSelectGame}
        onActivate={onActivate}
        cardRef={activeCard}
      />
    </View>
  ), [activeCard, dividerIndex, metrics.gap, onSelectGame, onActivate, selectedId]);

  const getSelectedScrollX = useCallback((rWidth: number) => {
    const cell = shelfItemLayout(selectedIndex, selectedIndex, dividerIndex, metrics);
    const left = cell.offset + (selectedIndex === dividerIndex ? metrics.dividerWidth + metrics.gap : 0);
    return Math.max(0, left - (rWidth - metrics.activeWidth) / 2);
  }, [dividerIndex, metrics, selectedIndex]);

  // Vị trí thẻ đang chọn tính được từ kích thước đã biết, không cần đo layout.
  const centerSelected = useCallback((animated: boolean) => {
    const currentW = railWidth.current > 0 ? railWidth.current : estimatedRailWidth;
    scrollCenter(getSelectedScrollX(currentW), animated);
  }, [estimatedRailWidth, getSelectedScrollX, scrollCenter]);

  // contentOffset is initial-only: updating it on selection would jump ahead of the animation.
  const [initialScrollX] = useState(() => getSelectedScrollX(estimatedRailWidth));

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => centerSelected(true));
    return () => { cancelAnimationFrame(frame); stopScroll(); };
  }, [selectedId, games.length, shelf.installedCount, centerSelected, stopScroll]);

  return (
      <FlatList
        ref={rail}
        data={shelf.ordered}
        renderItem={renderGame}
        keyExtractor={gameKey}
        getItemLayout={getItemLayout}
        renderScrollComponent={renderFocusRail}
        initialScrollIndex={selectedIndex}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={false}
        ListFooterComponent={<View style={{ width: estimatedRailWidth / 2 }} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialScrollX, y: 0 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={stopScroll}
        onLayout={(event) => {
          const w = event.nativeEvent.layout.width;
          if (w > 0) {
            const prev = railWidth.current;
            railWidth.current = w;
            if (Math.abs(prev - w) > 2) {
              centerSelected(false);
            }
          }
        }}
        style={{ flexGrow: 0, height: s(CONSOLE_CARD.railHeight) }}
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: s(10), paddingVertical: s(12) }}
        decelerationRate="fast"
        accessibilityRole="list"
      />
  );
});

const useStyles = makeStyles(({ colors, glass }) => ({
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: glass.surface,
  },
  uninstallTrack: { width: '100%', overflow: 'hidden', backgroundColor: glass.controlActive },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: alpha(colors.card, 0.85),
    // Android elevation renders a rectangular black backing behind translucent,
    // clipped cards. Keep the soft shadow only on iOS; the focus ring and glass
    // edge provide the selected state on Android without obscuring the artwork.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 18,
      },
      default: {},
    }),
  },
  error: {
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.3)',
    backgroundColor: 'rgba(80,12,12,0.65)',
    shadowColor: '#f87171',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  remoteConfirmBanner: {
    borderWidth: 1,
    borderColor: alpha(colors.accent, 0.4),
    backgroundColor: glass.panel,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  streamConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
  },
}));
