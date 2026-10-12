import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, Ellipsis, Info, Monitor, Newspaper, Play, ShoppingBag, Trophy, type LucideIcon } from 'lucide-react-native';

import type { LibraryPanel, PcGame } from '@/features/library/types';
import type { PcLibrary } from '@/features/library/usePcLibrary';
import { openExternal } from '@/lib/open-external';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

function GameTitle({ game }: { game: PcGame }) {
  const { s, width } = useUi();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logoUrl = game.art?.logoUrl && game.art.logoUrl !== failedLogo ? game.art.logoUrl : null;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

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
}

function PrimaryAction({ library, onPlay, onInstall, reachable }: {
  library: PcLibrary;
  onPlay: () => void;
  onInstall: () => void;
  reachable: boolean;
}) {
  const { s } = useUi();
  const { selected, launchingId, installingId } = library;
  const installed = selected?.installed !== false;
  const label = !reachable ? 'Mở máy tính' : installed ? (launchingId ? 'Đang mở' : 'Play') : installingId ? 'Đang mở Steam' : 'Cài đặt';
  const pulse = useRef(new Animated.Value(1)).current;
  const busy = Boolean(launchingId || installingId);
  useEffect(() => {
    if (!busy) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  const size = s(44);
  return (
    <Press
      onPress={!reachable || installed ? onPlay : onInstall}
      disabled={busy}
      accessibilityLabel={label}
      style={[styles.play, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Animated.View style={{ opacity: pulse }}>
        {!reachable ? (
          <Monitor size={s(18)} color={colors.white} />
        ) : installed ? (
          <Play size={s(18)} color={colors.white} fill={colors.white} style={{ marginLeft: s(2) }} />
        ) : (
          <Download size={s(18)} color={colors.white} />
        )}
      </Animated.View>
    </Press>
  );
}

function MenuItem({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { s } = useUi();
  return (
    <Press onPress={onPress} pressScale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingHorizontal: s(12), paddingVertical: s(9), borderRadius: s(12) }}>
      <Icon size={s(14)} color="rgba(255,255,255,0.82)" strokeWidth={1.8} />
      <T size={11} weight="medium" color="rgba(255,255,255,0.86)">{label}</T>
    </Press>
  );
}

/** Nút (…) cạnh Play: thông tin game, cập nhật, thành tựu, trang Store. */
function GameMenu({ game, open, onOpenChange, onOpenPanel }: {
  game: PcGame;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPanel: (panel: LibraryPanel) => void;
}) {
  const { s } = useUi();
  const choose = (panel: LibraryPanel) => {
    onOpenChange(false);
    onOpenPanel(panel);
  };
  const size = s(44);
  return (
    <View style={{ zIndex: 40 }}>
      <Press
        onPress={() => onOpenChange(!open)}
        accessibilityLabel="Tùy chọn game"
        style={[styles.more, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Ellipsis size={s(16)} color="rgba(255,255,255,0.7)" strokeWidth={2} />
      </Press>
      {open ? (
        <View style={[styles.menu, { bottom: size + s(8), minWidth: s(216), borderRadius: s(16), padding: s(6) }]}>
          <MenuItem icon={Info} label="Thông tin game" onPress={() => choose('info')} />
          {game.steamAppId ? <MenuItem icon={Newspaper} label="Cập nhật & bản sửa lỗi" onPress={() => choose('news')} /> : null}
          {game.steamAppId ? <MenuItem icon={Trophy} label="Thành tựu" onPress={() => choose('achievements')} /> : null}
          {game.storeUrl ? (
            <MenuItem icon={ShoppingBag} label="Store" onPress={() => { onOpenChange(false); void openExternal(game.storeUrl!); }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// Thẻ đang chọn 288x112, thẻ thường 88x88 (khung thiết kế 932x430).
const ACTIVE = { w: 288, h: 112 };
const IDLE = { w: 88, h: 88 };
const GAP = 12;

function GameCard({ game, active, achievements, onSelect }: {
  game: PcGame;
  active: boolean;
  achievements: PcLibrary['achievements'];
  onSelect: () => void;
}) {
  const { s } = useUi();
  const grow = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: active ? 1 : 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [active, grow]);

  const data = achievements.data;
  const percent = data?.supported && data.total ? Math.round(((data.unlocked || 0) / data.total) * 100) : null;
  return (
    <Press onPress={onSelect} pressScale={0.98} accessibilityLabel={game.title}>
      <Animated.View
        style={[
          styles.card,
          {
            borderRadius: s(16),
            width: grow.interpolate({ inputRange: [0, 1], outputRange: [s(IDLE.w), s(ACTIVE.w)] }),
            height: grow.interpolate({ inputRange: [0, 1], outputRange: [s(IDLE.h), s(ACTIVE.h)] }),
            marginBottom: grow.interpolate({ inputRange: [0, 1], outputRange: [s(8), 0] }),
            borderColor: grow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.8)'] }),
            opacity: grow.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
          },
        ]}
      >
        {game.artworkUrl ? <Img source={{ uri: game.artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(7,16,28,0)', 'rgba(7,16,28,0.62)']} style={StyleSheet.absoluteFill} />
        {active && data?.supported ? (
          <View style={[styles.trophy, { right: s(10), bottom: s(10), borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(6), gap: s(8) }]}>
            <T size={10.9} weight="semibold" tabular>{percent}%</T>
            <Trophy size={s(14)} color={colors.white} strokeWidth={1.8} />
            <T size={10.9} weight="semibold" tabular>{data.unlocked}/{data.total}</T>
          </View>
        ) : null}
      </Animated.View>
    </Press>
  );
}

/** Tab Games: logo + nút của game đang chọn, phía dưới là kệ mọi game trên PC. */
export function GamesView({ library, reachable, menuOpen, onMenuOpenChange, onSelectGame, onOpenPanel, onPlay }: {
  library: PcLibrary;
  reachable: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSelectGame: (id: string) => void;
  onOpenPanel: (panel: LibraryPanel) => void;
  onPlay: () => void;
}) {
  const { s } = useUi();
  const { games, selected, error, installOpenedId } = library;
  const rail = useRef<ScrollView>(null);
  const railWidth = useRef(0);
  const selectedIndex = Math.max(0, games.findIndex((game) => game.id === selected?.id));

  // Vị trí thẻ đang chọn tính được từ kích thước đã biết, không cần đo layout.
  const centerSelected = (animated: boolean) => {
    const idleW = s(IDLE.w);
    const activeW = s(ACTIVE.w);
    const left = selectedIndex * (idleW + s(GAP));
    const x = left - (railWidth.current - activeW) / 2;
    rail.current?.scrollTo({ x: Math.max(0, x), animated });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => centerSelected(true));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, games.length]);

  return (
    <View style={{ flex: 1 }}>
      {menuOpen ? <Pressable style={StyleSheet.absoluteFill} onPress={() => onMenuOpenChange(false)} /> : null}
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: s(16), paddingTop: s(8), zIndex: 40 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(28) }}>
          {selected ? <GameTitle key={selected.id} game={selected} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), zIndex: 40 }}>
            <PrimaryAction library={library} onPlay={onPlay} onInstall={() => void library.installSelected()} reachable={reachable} />
            {selected ? <GameMenu game={selected} open={menuOpen} onOpenChange={onMenuOpenChange} onOpenPanel={onOpenPanel} /> : null}
          </View>
        </View>

        {error ? (
          <View style={[styles.error, { marginTop: s(10), maxWidth: s(480), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(6) }]}>
            <T size={10.4} color="#fee2e2" leading={1.5}>{error}</T>
          </View>
        ) : null}
        {!error && selected && installOpenedId === selected.id ? (
          <T size={10.4} weight="medium" color="rgba(255,255,255,0.66)" style={{ marginTop: s(10) }}>
            Steam đã mở bước chọn ổ đĩa và xác nhận cài đặt.
          </T>
        ) : null}
      </View>

      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => { railWidth.current = event.nativeEvent.layout.width; centerSelected(false); }}
        style={{ flexGrow: 0, height: s(122) }}
        contentContainerStyle={{ alignItems: 'flex-end', gap: s(GAP), paddingHorizontal: s(2), paddingBottom: s(2) }}
        decelerationRate="fast"
        accessibilityRole="list"
      >
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            active={game.id === selected?.id}
            achievements={library.achievements}
            onSelect={() => onSelectGame(game.id)}
          />
        ))}
        <View style={{ width: s(ACTIVE.w) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(10,17,28,0.34)',
  },
  menu: {
    position: 'absolute',
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(10,17,28,0.96)',
    shadowColor: '#020812',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  card: { overflow: 'hidden', borderWidth: 1, backgroundColor: colors.card },
  trophy: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(10,17,28,0.58)',
  },
  error: {
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.2)',
    backgroundColor: 'rgba(69,10,10,0.54)',
  },
});
