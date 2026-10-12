import { useEffect, useRef, type RefObject } from 'react';
import { Animated, Easing, StyleSheet, TextInput, View } from 'react-native';
import { FocusScroll } from '@/features/gamepad/focus';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, WifiOff, X, type LucideIcon } from 'lucide-react-native';

import { formatStorePrice } from '@/features/library/format';
import type { SteamStoreItem } from '@/features/library/types';
import type { useStoreSearch } from '@/features/library/useSteamStore';
import { colors, fonts } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '_'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
] as const;

type SearchState = ReturnType<typeof useStoreSearch>;

/** Nút tròn mở rộng thành ô nhập tìm kiếm Steam trên header. */
export function StoreSearchField({ open, query, inputRef, onOpen, onQueryChange, onSubmit, onClose }: {
  open: boolean;
  query: string;
  inputRef: RefObject<TextInput | null>;
  onOpen: () => void;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { s, width } = useUi();
  const grow = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: open ? 1 : 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow, open]);

  const openWidth = Math.min(s(272), Math.max(s(176), width * 0.28));
  return (
    <Animated.View
      style={[
        styles.field,
        {
          height: s(36),
          borderRadius: s(18),
          width: grow.interpolate({ inputRange: [0, 1], outputRange: [s(36), openWidth] }),
          borderColor: grow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.14)', 'rgba(102,168,255,0.6)'] }),
          backgroundColor: grow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(10,17,28,0.48)', 'rgba(10,17,28,0.86)'] }),
        },
      ]}
    >
      <Press
        onPress={() => (open ? inputRef.current?.focus() : onOpen())}
        accessibilityLabel={open ? 'Ô tìm kiếm' : 'Mở tìm kiếm Steam'}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: s(36), alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >
        <Search size={s(16)} color="rgba(255,255,255,0.66)" strokeWidth={1.8} />
      </Press>
      {open ? (
        <>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(text) => onQueryChange(text.slice(0, 80))}
            onSubmitEditing={onSubmit}
            // Bàn phím trên màn hình của app thay cho bàn phím hệ thống, như bản web (inputMode=none).
            showSoftInputOnFocus={false}
            disableFullscreenUI
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="search"
            placeholder="Tìm game trên Steam"
            placeholderTextColor="rgba(255,255,255,0.42)"
            selectionColor={colors.accent}
            accessibilityLabel="Tìm game trên Steam"
            style={{
              flex: 1, paddingLeft: s(36), paddingRight: s(36), paddingVertical: 0,
              fontFamily: fonts.medium, fontSize: s(10.9), color: colors.white,
            }}
          />
          <Press
            onPress={() => {
              if (query) { onQueryChange(''); inputRef.current?.focus(); } else onClose();
            }}
            accessibilityLabel={query ? 'Xóa nội dung tìm kiếm' : 'Đóng tìm kiếm'}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: s(36), alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={s(14)} color="rgba(255,255,255,0.58)" strokeWidth={1.8} />
          </Press>
        </>
      ) : null}
    </Animated.View>
  );
}

function SearchMessage({ icon: Icon, title, detail, accent = false }: { icon: LucideIcon; title: string; detail: string; accent?: boolean }) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(24) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
        {accent ? (
          <View style={[styles.accentIcon, { width: s(40), height: s(40), borderRadius: s(20) }]}>
            <Icon size={s(16)} color="#8bbcff" strokeWidth={1.7} />
          </View>
        ) : (
          <Icon size={s(20)} color="rgba(255,255,255,0.36)" />
        )}
        <View>
          <T size={12} weight="medium" color="rgba(255,255,255,0.7)">{title}</T>
          <T size={9} color="rgba(255,255,255,0.4)" style={{ marginTop: s(2) }}>{detail}</T>
        </View>
      </View>
    </View>
  );
}

function SearchResultCard({ item, onOpen }: { item: SteamStoreItem; onOpen: () => void }) {
  const { s, width } = useUi();
  const cardWidth = Math.min(s(106), Math.max(s(86), width * 0.11));
  return (
    <Press onPress={onOpen} pressScale={0.98} accessibilityLabel={item.name} style={[styles.result, { width: cardWidth, borderRadius: s(12) }]}>
      <Img
        source={{ uri: item.portraitImage || item.smallImage || item.largeImage }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={String(item.appId)}
      />
      <LinearGradient colors={['rgba(6,16,29,0.04)', 'rgba(6,16,29,0)', 'rgba(6,16,29,0.96)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      {item.discounted ? (
        <View style={{ position: 'absolute', left: s(6), top: s(6), backgroundColor: colors.accent, borderRadius: s(6), paddingHorizontal: s(6), paddingVertical: s(2) }}>
          <T size={7.4} weight="bold" color={colors.onAccent} tabular>-{item.discountPercent}%</T>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: s(8) }}>
        <T size={9} weight="semibold" leading={1.2} numberOfLines={2}>{item.name}</T>
        <T size={7.7} weight="medium" color="rgba(255,255,255,0.56)" style={{ marginTop: s(4) }}>{formatStorePrice(item)}</T>
      </View>
    </Press>
  );
}

function SearchResults({ query, search, onOpenGame }: { query: string; search: SearchState; onOpenGame: (item: SteamStoreItem) => void }) {
  const { s, width } = useUi();
  if (query.length < 2) {
    return <SearchMessage icon={Search} accent title="Nhập ít nhất 2 ký tự" detail="Kết quả Steam sẽ xuất hiện theo hàng ngang." />;
  }
  if (search.loading) {
    const cardWidth = Math.min(s(106), Math.max(s(86), width * 0.11));
    return (
      <View style={{ flex: 1, flexDirection: 'row', gap: s(8), overflow: 'hidden' }}>
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} width={cardWidth} height={s(150)} radius={s(12)} tone={0.07} style={{ alignSelf: 'stretch', height: undefined }} />)}
      </View>
    );
  }
  if (search.error) return <SearchMessage icon={WifiOff} title="Không thể tìm kiếm lúc này" detail={search.error} />;
  if (!search.results.length) return <SearchMessage icon={Search} title="Không tìm thấy game phù hợp" detail="Thử một tên ngắn hơn hoặc kiểm tra lại chính tả." />;
  return (
    <FocusScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(8), paddingHorizontal: s(2) }}>
      {search.results.map((item) => <SearchResultCard key={item.appId} item={item} onOpen={() => onOpenGame(item)} />)}
    </FocusScroll>
  );
}

function Key({ label, onPress, flex = 1, accent = false, disabled = false }: {
  label: string; onPress: () => void; flex?: number; accent?: boolean; disabled?: boolean;
}) {
  const { s } = useUi();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      pressScale={0.94}
      accessibilityLabel={label}
      style={[
        styles.key,
        {
          flex, height: s(30), borderRadius: s(8),
          backgroundColor: accent ? (disabled ? 'rgba(255,255,255,0.1)' : colors.accent) : 'rgba(255,255,255,0.055)',
          borderColor: accent ? 'transparent' : 'rgba(255,255,255,0.1)',
        },
      ]}
    >
      <T size={accent || label.length > 1 ? 9.2 : 9.6} weight={accent ? 'bold' : 'semibold'} color={accent ? (disabled ? 'rgba(255,255,255,0.28)' : '#07111d') : 'rgba(255,255,255,0.82)'}>
        {label}
      </T>
    </Press>
  );
}

function StoreKeyboard({ canSubmit, onKey, onErase, onSubmit }: {
  canSubmit: boolean;
  onKey: (key: string) => void;
  onErase: () => void;
  onSubmit: () => void;
}) {
  const { s } = useUi();
  return (
    <View style={[styles.keyboard, { padding: s(10), borderRadius: s(16) }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s(4), marginBottom: s(6) }}>
        <T size={10} weight="semibold" color="rgba(255,255,255,0.72)">Bàn phím</T>
        <T size={8} color="rgba(255,255,255,0.34)">Chọn phím để nhập</T>
      </View>
      <View style={{ gap: s(4) }}>
        {KEYBOARD_ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: s(4) }}>
            {row.map((key) => <Key key={key} label={key} onPress={() => onKey(key)} />)}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: s(4), marginTop: s(2) }}>
          <Key label="Xóa" onPress={onErase} flex={0.8} />
          <Key label="Khoảng trắng" onPress={() => onKey(' ')} flex={2.4} />
          <Key label="Mở game" onPress={onSubmit} flex={1} accent disabled={!canSubmit} />
        </View>
      </View>
    </View>
  );
}

export function StoreSearchPanel({ query, search, onOpenGame, onKey, onErase, onSubmit }: {
  query: string;
  search: SearchState;
  onOpenGame: (item: SteamStoreItem) => void;
  onKey: (key: string) => void;
  onErase: () => void;
  onSubmit: () => void;
}) {
  const { s } = useUi();
  const trimmed = query.trim();
  return (
    <View style={{ flex: 1, gap: s(8), paddingTop: s(8) }}>
      <View style={[styles.results, { flex: 1, padding: s(10), borderRadius: s(16) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: s(4), paddingBottom: s(8) }}>
          <T size={14} weight="semibold" tracking={-0.02} numberOfLines={1} style={{ flex: 1 }}>
            {trimmed.length >= 2 ? `Kết quả cho “${trimmed}”` : 'Tìm game của bạn'}
          </T>
          <T size={9} weight="medium" color="rgba(255,255,255,0.46)" tabular>
            {search.loading ? 'Đang tìm...' : trimmed.length >= 2 ? `${search.total} game` : ''}
          </T>
        </View>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <SearchResults query={trimmed} search={search} onOpenGame={onOpenGame} />
        </View>
      </View>
      <StoreKeyboard canSubmit={search.results.length > 0} onKey={onKey} onErase={onErase} onSubmit={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { overflow: 'hidden', borderWidth: 1, justifyContent: 'center' },
  accentIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  result: {
    overflow: 'hidden',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  key: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  keyboard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(8,17,29,0.9)',
  },
  results: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(8,17,29,0.82)',
  },
});
