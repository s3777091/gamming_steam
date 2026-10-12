// Màn chính của app: tab Games (kệ game trên PC) và tab Store (Steam), cài đặt,
// hồ sơ Steam. Bản native của components/MobileVersionSelector.tsx — cùng bố cục
// ngang, cùng thao tác, cùng dữ liệu.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useBack, useGamepadTabs } from '@/features/gamepad/hooks';
import { useCaptureMode } from '@/features/gamepad/captureMode';
import { formatStorePrice, isSteamAppId } from '@/features/library/format';
import { GameAchievementsPanel, GameInfoPanel, GameNewsPanel } from '@/features/library/GamePanels';
import { PromotionPanel, SteamProfilePanel } from '@/features/library/ProfilePanels';
import type { LibraryPanel, SteamPromotion, SteamStoreItem, StoreTab } from '@/features/library/types';
import { usePcLibrary } from '@/features/library/usePcLibrary';
import { useSteamProfile } from '@/features/library/useSteamProfile';
import { useSteamStore, useStoreGameDetail, useStoreSearch } from '@/features/library/useSteamStore';
import ConsoleSettings, { type SettingsCategory } from '@/features/settings/ConsoleSettings';
import { savePendingGameLaunch } from '@/lib/game-launch';
import { useUi } from '@/ui/scale';

import { GamesView } from './GamesView';
import { LibraryHeader } from './LibraryHeader';
import { LibraryBackdrop, LibraryEmpty, LibrarySkeleton, StoreError, StoreLoading } from './LibraryStates';
import { PcPowerSheet } from './PcPowerSheet';
import { StoreGameDetail } from './StoreGameDetail';
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
  const searchInputRef = useRef<TextInput>(null);

  // Ở màn thư viện, tay cầm điều khiển con trỏ giao diện (không phải PC).
  useCaptureMode('ui');

  const library = usePcLibrary();
  const { selected } = library;
  const profile = useSteamProfile(library.games, library.achievementCache);
  const store = useSteamStore(activeTab === 'store');
  const storeSearch = useStoreSearch(storeQuery, storeSearchOpen);
  const storeDetail = useStoreGameDetail(selectedStoreItem);

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
  }, []);

  const anyOverlay = Boolean(settingsCategory || selectedStoreItem || selectedPromotion || panel || menuOpen || storeSearchOpen || powerOpen);

  // Nút B / Back: đóng lớp trên cùng trước. Các panel tự đăng ký Back riêng; ở đây
  // chỉ cần xử lý những lớp do màn này sở hữu (menu, ô tìm kiếm).
  useBack(() => {
    if (menuOpen) { setMenuOpen(false); return; }
    if (storeSearchOpen) { setStoreSearchOpen(false); searchInputRef.current?.blur(); return; }
    return true;
  }, menuOpen || storeSearchOpen);

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
      reachable={library.reachable}
      menuOpen={menuOpen}
      onMenuOpenChange={setMenuOpen}
      onSelectGame={selectGame}
      onOpenPanel={setPanel}
      onPlay={() => void play()}
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
    <View style={styles.root}>
      <LibraryBackdrop url={backdropUrl} store={activeTab === 'store'} />

      <View
        style={{
          flex: 1,
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

      {selectedStoreItem ? (
        <StoreGameDetail
          item={selectedStoreItem}
          detail={storeDetail.data}
          loading={storeDetail.loading}
          error={storeDetail.error}
          priceLabel={formatStorePrice({ finalPrice: selectedStoreItem.finalPrice, currency: selectedStoreItem.currency })}
          onClose={closeStoreDetail}
        />
      ) : null}

      {selectedPromotion ? (
        <PromotionPanel promotion={selectedPromotion} specials={store.data?.specials || []} onOpenGame={openStoreGame} onClose={closeStoreDetail} />
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

      {powerOpen ? (
        <PcPowerSheet
          onClose={() => setPowerOpen(false)}
          onReady={() => { setPowerOpen(false); void library.reload(true); }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#080c12' },
});
