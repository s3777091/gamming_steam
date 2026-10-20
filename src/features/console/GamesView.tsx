import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
import { alpha, CardSurface, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useBackdropPreload } from '@/ui/useBackdropPreload';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { SeasonPlayButton } from '@/ui/SeasonPlayButton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { DownloadStatusLine, ProgressRing, downloadInProgress } from './DownloadViews';
import type { FlightRect } from './DownloadFlight';

const GameTitle = memo(function GameTitle({ game }: { game: PcGame }) {
  const { s, width } = useUi();
  const { reduceMotion } = useMotion();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logoUrl = game.art?.logoUrl && game.art.logoUrl !== failedLogo ? game.art.logoUrl : null;
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 0 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  const maxHeight = Math.min(s(128), s(120));
  const maxWidth = Math.min(s(384), width * 0.4);
  const ratio = game.art?.logoWidth && game.art?.logoHeight ? game.art.logoWidth / game.art.logoHeight : 2.4;
  const logoWidth = Math.min(maxWidth, maxHeight * ratio);

  return (
    <Animated.View
      style={{
        flexShrink: 1,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {logoUrl ? (
        <Img
          source={{ uri: logoUrl }}
          accessibilityLabel={game.title}
          style={{ width: logoWidth, height: logoWidth / ratio }}
          contentFit="contain"
          contentPosition="left"
          onError={() => setFailedLogo(logoUrl)}
        />
      ) : (
        <T size={Math.min(54, Math.max(32, width * 0.054 / 1.4))} weight="semibold" tracking={-0.055} leading={0.98} numberOfLines={1}>
          {game.title}
        </T>
      )}
    </Animated.View>
  );
});

function PrimaryAction({ library, download, uninstall, canControl, onPlay, onInstall, onDownloadPress, reachable }: {
  library: PcLibrary;
  download: GameDownload | null;
  uninstall: GameUninstall | null;
  canControl: boolean;
  onPlay: () => void;
  onInstall: () => void;
  onDownloadPress: () => void;
  reachable: boolean;
}) {
  const styles = useStyles();
  const { s } = useUi();
  const { active: appActive, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  const { selected, launchingId, installingId } = library;
  const installed = selected?.installed !== false;
  // Đang tải: nút thành vòng tiến trình; bấm để tạm dừng/tiếp tục hoặc xem điều khoản.
  const tracking = reachable && !installed && downloadInProgress(download) ? download : null;
  const uninstalling = uninstall && uninstall.status !== 'failed' && uninstall.status !== 'uninstalled' ? uninstall : null;
  const label = uninstalling ? uninstalling.label : tracking ? tracking.label
    : !reachable ? 'Mở máy tính' : installed ? (launchingId ? 'Đang mở' : 'Play') : installingId ? 'Đang mở Steam' : 'Cài đặt';
  const [pulse] = useState(() => new Animated.Value(1));
  const busy = Boolean(launchingId || installingId || library.uninstallingId || uninstalling)
    || Boolean(tracking && ['preparing', 'working', 'queued', 'installed'].includes(tracking.status));
  useEffect(() => {
    if (!busy || !appActive || !sceneActive || reduceMotion) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [appActive, busy, pulse, reduceMotion, sceneActive]);

  const size = s(44);
  return (
    <SeasonPlayButton
      size={size}
      seasonal={reachable && installed && !tracking && !uninstalling}
      onPress={tracking ? onDownloadPress : !reachable || installed ? onPlay : onInstall}
      sound="confirm"
      disabled={tracking ? false : busy}
      autoFocus
      accessibilityLabel={label}
      style={[styles.play, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {(ink) => (
        <>
          {uninstalling ? <ProgressRing size={size} percent={uninstalling.progress} /> : tracking ? <ProgressRing size={size} percent={tracking.percent} /> : null}
          <Animated.View style={{ opacity: pulse }}>
            {uninstalling ? (
              <Trash2 size={s(16)} color={ink} />
            ) : tracking ? (
              tracking.status === 'eula' ? <FileText size={s(17)} color={ink} />
                : tracking.status === 'config' ? <HardDrive size={s(17)} color={ink} />
                : tracking.status === 'downloading' && canControl ? <Pause size={s(16)} color={ink} fill={ink} />
                  : <Download size={s(16)} color={ink} />
            ) : !reachable ? (
              <Monitor size={s(18)} color={ink} />
            ) : installed ? (
              <Play size={s(18)} color={ink} fill={ink} style={{ marginLeft: s(2) }} />
            ) : (
              <Download size={s(18)} color={ink} />
            )}
          </Animated.View>
        </>
      )}
    </SeasonPlayButton>
  );
}

/** Nút (…) cạnh Play: mở bảng tùy chọn game phong cách Console. */
function GameMoreButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const { glass } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const size = s(44);
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="Tùy chọn game"
      style={[
        styles.more,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: active ? glass.controlBorderActive : glass.controlBorder,
          backgroundColor: active ? glass.controlActive : glass.control,
        },
      ]}
    >
      <Ellipsis size={s(16)} color={active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
    </Press>
  );
}

// Thẻ đang chọn 288x112, thẻ thường 88x88 (khung thiết kế 932x430).
const ACTIVE = { w: 288, h: 112 };
const IDLE = { w: 88, h: 88 };
const GAP = 12;
// Vạch đứng ngăn game đã cài (bên trái) với game chưa cài (bên phải).
const DIVIDER = { w: 1.5, h: 88 };

// Keep gamepad scroll ancestry intact inside FlatList's virtualized cells.
function renderFocusRail(props: ScrollViewProps) {
  return <FocusScroll {...props} />;
}

const gameKey = (game: PcGame) => game.id;

function ShelfDivider() {
  const { colors } = useTheme();
  const { s } = useUi();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0)', alpha(colors.accent, 0.65), 'rgba(255,255,255,0)']}
      style={{ width: s(DIVIDER.w), height: s(DIVIDER.h), marginBottom: s(8), borderRadius: s(DIVIDER.w) }}
    />
  );
}

const GameCard = memo(function GameCard({ game, active, achievements, onSelect, cardRef }: {
  game: PcGame;
  active: boolean;
  achievements: PcLibrary['achievements']['data'];
  onSelect: (id: string) => void;
  /** Gắn vào thẻ đang chọn: điểm xuất phát của hiệu ứng thẻ bay vào thông báo. */
  cardRef: RefObject<View | null>;
}) {
  const { glass } = useTheme();
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
    if (!changed) return;
    const animation = Animated.spring(selection, {
      toValue: active ? 1 : 0,
      stiffness: 260,
      damping: 26,
      mass: 0.72,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, selection]);

  const data = achievements;
  const percent = data?.supported && data.total ? Math.round(((data.unlocked || 0) / data.total) * 100) : null;
  return (
    <View ref={active ? cardRef : undefined} collapsable={false}>
    <Press onPress={select} onFocused={select} focusRadius={s(active ? 20 : 16)} focusVariant="glassCard" pressScale={0.98} accessibilityLabel={game.title}>
      <Animated.View
        style={[
          styles.card,
          {
            borderRadius: s(active ? 20 : 16),
            width: s(active ? ACTIVE.w : IDLE.w),
            height: s(active ? ACTIVE.h : IDLE.h),
            marginBottom: active ? 0 : s(8),
            borderColor: active ? glass.cardBorderActive : glass.cardBorder,
            opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [0.76, 1] }),
            transform: [
              { scale: selection.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
              { translateY: selection.interpolate({ inputRange: [0, 1], outputRange: [s(2), 0] }) },
            ],
          },
        ]}
      >
        {game.artworkUrl ? <Img source={{ uri: game.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <CardSurface selected={active} radius={s(active ? 20 : 16)} />
        {active && data?.supported ? (
          <View style={[styles.trophy, { right: s(10), bottom: s(10), borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(6), gap: s(8) }]}>
            <T size={10.9} weight="bold" color="#ffffff" tabular>{percent}%</T>
            <Trophy size={s(14)} color="#ffffff" strokeWidth={1.8} />
            <T size={10.9} weight="semibold" color="rgba(255,255,255,0.9)" tabular>{data.unlocked}/{data.total}</T>
          </View>
        ) : null}
      </Animated.View>
    </Press>
    </View>
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
  const activeCard = useRef<View>(null);
  const { games, selected, error, installOpenedId } = library;
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

  return (
    <View style={{ flex: 1 }}>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: s(16), paddingTop: s(8), zIndex: 40 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(28) }}>
          {selected ? <GameTitle game={selected} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), zIndex: 40 }}>
            <PrimaryAction
              library={library}
              download={download}
              uninstall={uninstall}
              canControl={downloads.canControl}
              onPlay={onPlay}
              onInstall={() => void install()}
              onDownloadPress={onDownloadPress}
              reachable={reachable}
            />
            {selected ? (
              <GameMoreButton
                active={menuOpen}
                onPress={() => onMenuOpenChange(!menuOpen)}
              />
            ) : null}
          </View>
        </View>

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
      </View>

      <GameShelf
        games={games}
        selectedId={selected?.id ?? null}
        selectedAchievements={library.achievements.data}
        activeCard={activeCard}
        onSelectGame={onSelectGame}
      />
    </View>
  );
});

/** Download progress never invalidates the virtualized game shelf. */
const GameShelf = memo(function GameShelf({ games, selectedId, selectedAchievements, activeCard, onSelectGame }: {
  games: PcGame[];
  selectedId: string | null;
  selectedAchievements: PcLibrary['achievements']['data'];
  activeCard: RefObject<View | null>;
  onSelectGame: (id: string) => void;
}) {
  const { s, width, insets } = useUi();
  const estimatedRailWidth = Math.max(100, width - (s(44) + insets.left + insets.right));
  const rail = useRef<FlatList<PcGame>>(null);
  const railWidth = useRef(estimatedRailWidth);
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
    idleWidth: s(IDLE.w), activeWidth: s(ACTIVE.w), gap: s(GAP), dividerWidth: s(DIVIDER.w), padding: s(10),
  }), [s]);
  const dividerIndex = shelf.hasDivider ? shelf.installedCount : null;
  const getItemLayout = useCallback((_data: ArrayLike<PcGame> | null | undefined, index: number) => (
    shelfItemLayout(index, selectedIndex, dividerIndex, metrics)
  ), [dividerIndex, metrics, selectedIndex]);
  const renderGame = useCallback(({ item: game, index }: ListRenderItemInfo<PcGame>) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: metrics.gap, marginRight: metrics.gap }}>
      {index === dividerIndex ? <ShelfDivider /> : null}
      <GameCard
        game={game}
        active={game.id === selectedId}
        achievements={game.id === selectedId ? selectedAchievements : null}
        onSelect={onSelectGame}
        cardRef={activeCard}
      />
    </View>
  ), [activeCard, dividerIndex, metrics.gap, onSelectGame, selectedId, selectedAchievements]);

  const getSelectedScrollX = useCallback((rWidth: number) => {
    const cell = shelfItemLayout(selectedIndex, selectedIndex, dividerIndex, metrics);
    const left = cell.offset + (selectedIndex === dividerIndex ? metrics.dividerWidth + metrics.gap : 0);
    return Math.max(0, left - (rWidth - metrics.activeWidth) / 2);
  }, [dividerIndex, metrics, selectedIndex]);

  // Vị trí thẻ đang chọn tính được từ kích thước đã biết, không cần đo layout.
  const centerSelected = useCallback((animated: boolean) => {
    const currentW = railWidth.current > 0 ? railWidth.current : estimatedRailWidth;
    const x = getSelectedScrollX(currentW);
    rail.current?.scrollToOffset({ offset: x, animated });
  }, [estimatedRailWidth, getSelectedScrollX]);

  const initialScrollX = useMemo(() => {
    return getSelectedScrollX(estimatedRailWidth);
  }, [estimatedRailWidth, getSelectedScrollX]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => centerSelected(true));
    return () => cancelAnimationFrame(frame);
  }, [selectedId, games.length, shelf.installedCount, centerSelected]);

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
        ListFooterComponent={<View style={{ width: metrics.activeWidth }} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialScrollX, y: 0 }}
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
        style={{ flexGrow: 0, height: s(142) }}
        contentContainerStyle={{ alignItems: 'flex-end', paddingHorizontal: s(10), paddingTop: s(10), paddingBottom: s(12) }}
        decelerationRate="fast"
        accessibilityRole="list"
      />
  );
});

const useStyles = makeStyles(({ colors, glass }) => ({
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: glass.controlBorderActive,
    shadowColor: colors.primaryHover,
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: glass.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
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
  trophy: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: glass.controlBorder,
    backgroundColor: alpha(colors.panelSolid, 0.7),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
