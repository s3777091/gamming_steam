import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Monitor, RefreshCw, WifiOff } from 'lucide-react-native';

import { failBackdrop, finishBackdrop, requestBackdrop } from '@/lib/backdrop-state';
import { alpha } from '@/theme';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';
import { T } from '@/ui/Text';
import { CONSOLE, CONSOLE_CARD } from './consoleVisuals';
import { ConsoleAction } from './ConsoleControls';

type BackdropProps = {
  url: string | null | undefined;
  fallbackUrl?: string | null;
};

const BACKDROP_FADE_MS = CONSOLE.backdropMs;

/** Show the selected game's cached card while the full background downloads. */
function BackdropLayer({ url, opacity, preview, layerOpacity, retryDirect, onLoaded, onReady, onError, onDispose }: {
  url: string;
  opacity: number;
  preview: boolean;
  layerOpacity: Animated.Value;
  retryDirect: boolean;
  onLoaded: (url: string) => void;
  onReady: (url: string) => void;
  onError: (url: string) => void;
  onDispose: (url: string) => void;
}) {
  const { reduceMotion } = useMotion();
  const [fade] = useState(() => new Animated.Value(0));
  const started = useRef(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  useLayoutEffect(() => () => {
    animation.current?.stop();
    onDispose(url);
  }, [onDispose, url]);
  const reveal = () => {
    onLoaded(url);
    if (!preview || started.current) return;
    started.current = true;
    animation.current = Animated.timing(fade, {
      toValue: opacity, duration: reduceMotion ? 0 : 120,
      easing: TAB_MOTION_EASING, useNativeDriver: true, isInteraction: false,
    });
    animation.current.start(({ finished }) => { if (finished) onReady(url); });
  };
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: preview ? fade : layerOpacity }]}>
      <Img source={url} style={StyleSheet.absoluteFill} contentFit="cover" transition={0}
        priority="high" retryDirect={retryDirect} onLoad={reveal} onDisplay={reveal} onError={() => onError(url)} />
    </Animated.View>
  );
}

/** Keep the displayed native image mounted until its replacement has loaded. */
function BackdropImage({ url, fallbackUrl }: BackdropProps) {
  const requested = url || null;
  const fallback = fallbackUrl || null;
  const targetOpacity = 1;
  const { reduceMotion } = useMotion();
  const [images, setImages] = useState(() => requestBackdrop(null, requested, fallback));
  const [incoming] = useState(() => new Animated.Value(0));
  const [currentFade] = useState(() => new Animated.Value(0));
  const revealRef = useRef<{ url: string; start: () => void } | null>(null);
  const loadedUrlsRef = useRef(new Set<string>());

  if (requested !== images.requested || fallback !== images.fallback) {
    setImages(requestBackdrop(images, requested, fallback));
  }

  const { current, pending } = images;
  useLayoutEffect(() => {
    let cancelled = false;
    let started = false;
    let animation: Animated.CompositeAnimation | null = null;
    const timing = (value: Animated.Value, toValue: number) => Animated.timing(value, {
      toValue,
      duration: reduceMotion ? 0 : BACKDROP_FADE_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });

    if (!requested) {
      animation = timing(currentFade, 0);
      animation.start(({ finished }) => {
        if (!finished || cancelled) return;
        setImages((value) => value.requested === null ? { ...value, current: null } : value);
      });
    } else if (pending) {
      incoming.setValue(0);
      const start = () => {
        if (cancelled || started) return;
        started = true;
        animation = timing(incoming, targetOpacity);
        animation.start(({ finished }) => {
          if (!finished || cancelled) return;
          currentFade.setValue(targetOpacity);
          setImages((value) => finishBackdrop(value, pending));
        });
      };
      revealRef.current = { url: pending, start };
      if (loadedUrlsRef.current.has(pending)) start();
    } else {
      currentFade.setValue(targetOpacity);
    }

    return () => {
      cancelled = true;
      revealRef.current = null;
      animation?.stop();
    };
  }, [currentFade, incoming, pending, reduceMotion, requested, targetOpacity]);

  const reveal = useCallback((loadedUrl: string) => {
    loadedUrlsRef.current.add(loadedUrl);
    if (revealRef.current?.url === loadedUrl) revealRef.current.start();
  }, []);
  const forget = useCallback((disposedUrl: string) => {
    loadedUrlsRef.current.delete(disposedUrl);
  }, []);
  const failed = useCallback((failedUrl: string) => {
    setImages((value) => failBackdrop(value, failedUrl));
  }, []);
  const coverReady = useCallback((coverUrl: string) => {
    currentFade.setValue(targetOpacity);
    setImages((value) => finishBackdrop(value, coverUrl));
  }, [currentFade, targetOpacity]);
  const preview = pending === requested && fallback !== current && fallback !== pending && !images.fallbackFailed ? fallback : null;

  return (
    <>
      {[current, preview, pending].map((imageUrl, index) => imageUrl ? (
        <BackdropLayer key={imageUrl} url={imageUrl} opacity={targetOpacity} preview={index === 1}
          layerOpacity={index === 2 ? incoming : currentFade} retryDirect={imageUrl === fallback || !fallback}
          onLoaded={reveal} onReady={coverReady} onError={failed} onDispose={forget} />
      ) : null)}
    </>
  );
}

/** Games and Store share one artwork-first backdrop treatment. */
export const LibraryBackdrop = memo(function LibraryBackdrop({ url, fallbackUrl }: BackdropProps) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: CONSOLE.background }]} pointerEvents="none">
      <BackdropImage url={url} fallbackUrl={fallbackUrl} />
      <LinearGradient
        colors={['rgba(6,11,8,0.48)', 'rgba(6,11,8,0.16)', 'transparent', 'rgba(6,11,8,0.08)']}
        locations={[0, 0.47, 0.76, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(6,11,8,0.24)', 'transparent', 'rgba(6,11,8,0.14)', 'rgba(6,11,8,0.94)']}
        locations={[0, 0.3, 0.48, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
});
/**
 * Nền desktop tĩnh với cùng sắc xanh lá của navigation.
 * Phủ kín trên ảnh game và mờ dần vào/ra khi đổi tab.
 */
export const PcWallpaper = memo(function PcWallpaper({ visible }: { visible: boolean }) {
  const { width, height } = useUi();
  const { reduceMotion } = useMotion();
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));
  const shade = CONSOLE.background;

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : TAB_MOTION_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, anim, reduceMotion]);

  const petal = (
    size: number, left: number, top: number, rotate: string, colors: [string, string],
  ) => (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        position: 'absolute',
        width: size,
        height: size * 0.56,
        left,
        top,
        borderRadius: size,
        transform: [{ rotate }],
      }}
    />
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]} pointerEvents="none">
      <LinearGradient
        colors={[CONSOLE.background, '#142c20', '#294b36']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {petal(width * 0.62, width * 0.44, -height * 0.18, '-24deg', ['rgba(72,119,87,0.85)', 'rgba(25,51,35,0.15)'])}
      {petal(width * 0.5, width * 0.6, height * 0.12, '38deg', ['rgba(129,168,140,0.6)', 'rgba(50,87,61,0.2)'])}
      {petal(width * 0.46, width * 0.3, height * 0.34, '-52deg', ['rgba(62,105,76,0.8)', 'rgba(20,40,28,0.1)'])}
      {petal(width * 0.34, width * 0.7, height * 0.5, '12deg', ['rgba(129,168,140,0.5)', 'rgba(50,87,61,0.1)'])}
      <LinearGradient
        colors={[alpha(shade, 0.86), alpha(shade, 0.4), alpha(shade, 0.08), alpha(shade, 0.32)]}
        locations={[0, 0.4, 0.74, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[alpha(shade, 0.4), alpha(shade, 0), alpha(shade, 0.78)]}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

function ConsoleSkeleton({ store = false }: { store?: boolean }) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: s(10), paddingHorizontal: s(10), paddingBottom: s(10) }}>
        <Skeleton width={s(220)} height={s(56)} radius={s(10)} />
        <Skeleton width={s(240)} height={s(12)} radius={s(4)} tone={0.07} />
        <Skeleton width={s(146)} height={s(44)} radius={s(12)} />
      </View>
      <View style={{ height: s(CONSOLE_CARD.railHeight), flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(10), overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} width={s(CONSOLE_CARD.width)} height={s(CONSOLE_CARD.height)} radius={s(CONSOLE_CARD.radius)} tone={0.08} />
        ))}
      </View>
      {store ? <View style={{ flexDirection: 'row', gap: s(10), marginHorizontal: s(10), marginBottom: s(6), height: s(56) }}>
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={s(56)} radius={s(10)} tone={0.08} style={{ flex: item === 0 ? 1.25 : 1 }} />)}
      </View> : null}
      <View style={{ height: s(30) }} />
    </View>
  );
}

export function StoreLoading() { return <ConsoleSkeleton store />; }
export function LibrarySkeleton() { return <ConsoleSkeleton />; }
function RoundIcon({ children }: { children: React.ReactNode }) {
  const { s } = useUi();
  return (
    <View style={{
      width: s(54), height: s(54), borderRadius: s(16), alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: CONSOLE.navigationBorder, backgroundColor: CONSOLE.navigation,
    }}
    >
      {children}
    </View>
  );
}

export function StoreError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ maxWidth: s(380), alignItems: 'center' }}>
        <RoundIcon><WifiOff size={s(22)} color="rgba(255,255,255,0.7)" /></RoundIcon>
        <T size={18} weight="semibold" tracking={-0.02} style={{ marginTop: s(14) }}>Không tải được Steam Store</T>
        <T size={12} color={CONSOLE.muted} leading={1.6} style={{ marginTop: s(6), textAlign: 'center' }}>{message}</T>
        <ConsoleAction label="Thử lại" onPress={onRetry} autoFocus style={{ marginTop: s(14), alignSelf: 'center' }}
          icon={<RefreshCw size={s(18)} color={CONSOLE.ink} strokeWidth={2} />} />
      </View>
    </View>
  );
}

export function LibraryEmpty({ error, warning, refreshing, onOpenPc, onRetry }: {
  error: string | null;
  warning: string | null;
  refreshing: boolean;
  onOpenPc: () => void;
  onRetry: () => void;
}) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ maxWidth: s(380), alignItems: 'center' }}>
        <RoundIcon>
          {error ? <WifiOff size={s(22)} color="rgba(255,255,255,0.7)" /> : <Gamepad2 size={s(22)} color="rgba(255,255,255,0.7)" />}
        </RoundIcon>
        <T size={18} weight="semibold" tracking={-0.02} style={{ marginTop: s(14) }}>
          {error ? 'Chưa kết nối được máy tính' : warning ? 'Chưa đọc được thư viện Steam' : 'Chưa tìm thấy trò chơi có thể cài'}
        </T>
        <T size={12} color={CONSOLE.muted} leading={1.6} style={{ marginTop: s(6), textAlign: 'center' }}>
          {error || warning || 'Mở Steam trên máy tính để đồng bộ thư viện rồi thử lại.'}
        </T>
        <View style={{ flexDirection: 'row', gap: s(12), marginTop: s(16) }}>
          <ConsoleAction label="Mở máy tính" onPress={onOpenPc} autoFocus
            icon={<Monitor size={s(18)} color={CONSOLE.ink} strokeWidth={2} />} />
          <Press
            onPress={onRetry}
            disabled={refreshing}
            accessibilityLabel="Thử lại"
            focusVariant="quiet"
            style={{
              width: s(44), height: s(44), borderRadius: s(12), alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: CONSOLE.border, backgroundColor: CONSOLE.control,
              opacity: refreshing ? 0.55 : 1,
            }}
          >
            <RefreshCw size={s(14)} color="rgba(255,255,255,0.85)" strokeWidth={2} />
          </Press>
        </View>
      </View>
    </View>
  );
}
