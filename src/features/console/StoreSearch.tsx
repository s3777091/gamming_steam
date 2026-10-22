import { memo, useCallback, useEffect, useState, type RefObject } from 'react';
import { Animated, Easing, StyleSheet, TextInput, View } from 'react-native';
import { FocusScroll } from '@/features/gamepad/focus';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, WifiOff, X, type LucideIcon } from 'lucide-react-native';

import { formatStorePrice } from '@/features/library/format';
import type { SteamStoreItem } from '@/features/library/types';
import type { useStoreSearch } from '@/features/library/useSteamStore';
import { fonts, makeStyles } from '@/theme';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { CONSOLE } from './consoleVisuals';

const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '_'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
] as const;

type SearchState = ReturnType<typeof useStoreSearch>;

/** Nút tròn mở rộng thành ô nhập tìm kiếm Steam trên header với hiệu ứng Liquid Glass. */
export function StoreSearchField({ open, query, inputRef, onOpen, onQueryChange, onSubmit, onClose }: {
  open: boolean;
  query: string;
  inputRef: RefObject<TextInput | null>;
  onOpen: () => void;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { s, width } = useUi();
  const { reduceMotion } = useMotion();
  const fieldHeight = s(32);
  const fieldRadius = s(16);
  const [grow] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(grow, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : CONSOLE.infoMs,
      easing: open ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [grow, open, reduceMotion]);

  const openWidth = Math.min(s(272), Math.max(s(176), width * 0.28));
  return (
    <Animated.View
      style={[
        styles.field,
        {
          height: fieldHeight, overflow: open ? 'hidden' : 'visible',
          borderRadius: fieldRadius,
          width: grow.interpolate({ inputRange: [0, 1], outputRange: [fieldHeight, openWidth] }),
          borderColor: grow.interpolate({
            inputRange: [0, 1],
            outputRange: [CONSOLE.border, CONSOLE.navigationSelectedBorder],
          }),
          backgroundColor: grow.interpolate({
            inputRange: [0, 1],
            outputRange: [CONSOLE.control, CONSOLE.navigation],
          }),
        },
      ]}
    >

      {!open ? (
        <Press
          onPress={onOpen}
          sound="confirm"
          focusRadius={fieldRadius}
          focusVariant="quiet"
          accessibilityLabel="Mở tìm kiếm Steam"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: fieldRadius,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            },
          ]}
        >
          <Search size={s(15)} color="rgba(255,255,255,0.72)" strokeWidth={1.8} />
        </Press>
      ) : (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: fieldHeight,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <Search size={s(15)} color="rgba(255,255,255,0.66)" strokeWidth={1.8} />
          </View>

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
            selectionColor={CONSOLE.controllerA}
            accessibilityLabel="Tìm game trên Steam"
            style={{
              flex: 1,
              paddingLeft: fieldHeight,
              paddingRight: fieldHeight,
              paddingVertical: 0,
              fontFamily: fonts.medium,
              fontSize: s(10.9),
              color: CONSOLE.ink,
            }}
          />

          <Press
            focusable={false}
            sound="confirm"
            onPress={() => {
              if (query) {
                onQueryChange('');
                inputRef.current?.focus();
              } else {
                onClose();
              }
            }}
            accessibilityLabel={query ? 'Xóa nội dung tìm kiếm' : 'Đóng tìm kiếm'}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: fieldHeight,
              borderRadius: fieldRadius,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <X size={s(14)} color="rgba(255,255,255,0.58)" strokeWidth={1.8} />
          </Press>
        </>
      )}
    </Animated.View>
  );
}

function SearchMessage({ icon: Icon, title, detail, accent = false }: { icon: LucideIcon; title: string; detail: string; accent?: boolean }) {
  const styles = useStyles();
  const { s } = useUi();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(24) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
        {accent ? (
          <View style={[styles.accentIcon, { width: s(40), height: s(40), borderRadius: s(20) }]}>
            <Icon size={s(16)} color={CONSOLE.controllerA} strokeWidth={1.7} />
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

const SearchResultCard = memo(function SearchResultCard({ item, onOpen }: { item: SteamStoreItem; onOpen: (item: SteamStoreItem) => void }) {
  const styles = useStyles();
  const { s, width } = useUi();
  const open = useCallback(() => onOpen(item), [item, onOpen]);
  const cardWidth = Math.min(s(106), Math.max(s(86), width * 0.11));
  return (
    <Press onPress={open} focusVariant="quiet" focusScale={1.05} pressScale={0.97} accessibilityLabel={item.name} style={[styles.result, { width: cardWidth, borderRadius: s(10), overflow: 'visible' }]}>
      <Img
        source={{ uri: item.portraitImage || item.smallImage || item.largeImage }}
        style={[StyleSheet.absoluteFill, { borderRadius: s(10) }]}
        contentFit="cover"
        recyclingKey={String(item.appId)}
      />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(6,11,8,0.94)']}
        locations={[0.25, 1]} style={[StyleSheet.absoluteFill, { borderRadius: s(10) }]} />
      {item.discounted ? (
        <View
          style={{
            position: 'absolute',
            left: s(6),
            top: s(6),
            backgroundColor: CONSOLE.navigation,
            borderRadius: s(7),
            paddingHorizontal: s(6),
            paddingVertical: s(2),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: CONSOLE.navigationSelectedBorder,
          }}
        >
          <T size={7.4} weight="bold" color={CONSOLE.ink} tabular>-{item.discountPercent}%</T>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: s(8) }}>
        <T size={9.2} weight="semibold" leading={1.22} numberOfLines={2}>{item.name}</T>
        <T size={7.8} weight="medium" color="rgba(255,255,255,0.6)" style={{ marginTop: s(4) }}>{formatStorePrice(item)}</T>
      </View>
    </Press>
  );
});

const SearchResults = memo(function SearchResults({ query, search, onOpenGame }: { query: string; search: SearchState; onOpenGame: (item: SteamStoreItem) => void }) {
  const { s, width } = useUi();
  if (query.length < 2) {
    return <SearchMessage icon={Search} accent title="Nhập ít nhất 2 ký tự" detail="Kết quả Steam sẽ xuất hiện theo hàng ngang." />;
  }
  if (search.loading) {
    const cardWidth = Math.min(s(106), Math.max(s(86), width * 0.11));
    return (
      <View style={{ flex: 1, flexDirection: 'row', gap: s(8), overflow: 'hidden' }}>
        {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} width={cardWidth} height={s(150)} radius={s(14)} tone={0.07} style={{ alignSelf: 'stretch', height: undefined }} />)}
      </View>
    );
  }
  if (search.error) return <SearchMessage icon={WifiOff} title="Không thể tìm kiếm lúc này" detail={search.error} />;
  if (!search.results.length) return <SearchMessage icon={Search} title="Không tìm thấy game phù hợp" detail="Thử một tên ngắn hơn hoặc kiểm tra lại chính tả." />;
  return (
    <FocusScroll horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -s(4), marginVertical: -s(6) }} contentContainerStyle={{ gap: s(8), paddingHorizontal: s(6), paddingVertical: s(6) }}>
      {search.results.map((item) => <SearchResultCard key={item.appId} item={item} onOpen={onOpenGame} />)}
    </FocusScroll>
  );
});

function Key({ label, onPress, flex = 1, accent = false, disabled = false }: {
  label: string; onPress: () => void; flex?: number; accent?: boolean; disabled?: boolean;
}) {
  const styles = useStyles();
  const { s } = useUi();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      pressScale={0.93}
      focusVariant="quiet"
      accessibilityLabel={label}
      style={[
        styles.key,
        {
          flex,
          height: s(31),
          borderRadius: s(9), overflow: 'visible',
          backgroundColor: accent
            ? (disabled ? CONSOLE.control : CONSOLE.action)
            : CONSOLE.control,
          borderColor: accent
            ? (disabled ? CONSOLE.border : CONSOLE.actionBorder)
            : CONSOLE.border,
        },
      ]}
    >
      {/* Specular rim on top of key */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(255,255,255,0.22)', marginHorizontal: s(3),
        }}
        pointerEvents="none"
      />
      <T size={accent || label.length > 1 ? 9.2 : 9.8} weight={accent ? 'bold' : 'semibold'} color={disabled ? CONSOLE.muted : CONSOLE.ink}>
        {label}
      </T>
    </Press>
  );
}

const StoreKeyboard = memo(function StoreKeyboard({ canSubmit, onKey, onErase, onSubmit }: {
  canSubmit: boolean;
  onKey: (key: string) => void;
  onErase: () => void;
  onSubmit: () => void;
}) {
  const styles = useStyles();
  const { s } = useUi();
  return (
    <View style={[styles.keyboard, { padding: s(10), borderRadius: s(18) }]}>
      {/* Specular top rim */}
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.02)', 'transparent']}
        locations={[0, 0.3, 1]}
        style={[StyleSheet.absoluteFill, { height: '30%' }]}
        pointerEvents="none"
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s(4), marginBottom: s(6) }}>
        <T size={10} weight="semibold" color="rgba(255,255,255,0.76)">Bàn phím</T>
        <T size={8} color="rgba(255,255,255,0.38)">Chọn phím để nhập</T>
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
});

export function StoreSearchPanel({ query, search, onOpenGame, onKey, onErase, onSubmit }: {
  query: string;
  search: SearchState;
  onOpenGame: (item: SteamStoreItem) => void;
  onKey: (key: string) => void;
  onErase: () => void;
  onSubmit: () => void;
}) {
  const styles = useStyles();
  const { s } = useUi();
  const trimmed = query.trim();
  return (
    <View style={{ flex: 1, gap: s(8), paddingTop: s(8) }}>
      <View style={[styles.results, { flex: 1, padding: s(10), borderRadius: s(18) }]}>
        {/* Specular top rim */}
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)', 'transparent']}
          locations={[0, 0.25, 1]}
          style={[StyleSheet.absoluteFill, { height: '30%' }]}
          pointerEvents="none"
        />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: s(4), paddingBottom: s(8) }}>
          <T size={14} weight="semibold" tracking={-0.02} numberOfLines={1} style={{ flex: 1 }}>
            {trimmed.length >= 2 ? `Kết quả cho “${trimmed}”` : 'Tìm game của bạn'}
          </T>
          <T size={9} weight="medium" color="rgba(255,255,255,0.5)" tabular>
            {search.loading ? 'Đang tìm...' : trimmed.length >= 2 ? `${search.total} game` : ''}
          </T>
        </View>
        <View style={{ flex: 1, overflow: 'visible' }}>
          <SearchResults query={trimmed} search={search} onOpenGame={onOpenGame} />
        </View>
      </View>
      <StoreKeyboard canSubmit={search.results.length > 0} onKey={onKey} onErase={onErase} onSubmit={onSubmit} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  field: {
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
  },
  accentIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CONSOLE.navigationBorder,
    backgroundColor: CONSOLE.navigation,
  },
  result: {
    overflow: 'hidden',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: CONSOLE.border,
    backgroundColor: CONSOLE.card,
  },
  key: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyboard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CONSOLE.border,
    backgroundColor: CONSOLE.panel,
  },
  results: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CONSOLE.border,
    backgroundColor: 'rgba(14,25,19,0.92)',
  },
}));
