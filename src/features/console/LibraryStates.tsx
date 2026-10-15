import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Monitor, RefreshCw, WifiOff } from 'lucide-react-native';

import { colors } from '@/theme';
import { failBackdrop, finishBackdrop, requestBackdrop } from '@/lib/backdrop-state';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { LiquidAmbientAurora } from '@/ui/LiquidGlass';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { TAB_MOTION_EASING, TAB_MOTION_MS } from './tabMotion';
import { T } from '@/ui/Text';

type BackdropProps = {
  url: string | null | undefined;
  fallbackUrl?: string | null;
  store: boolean;
};

const BACKDROP_FADE_MS = 180;

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
function BackdropImage({ url, fallbackUrl, store }: BackdropProps) {
  const requested = url || null;
  const fallback = fallbackUrl || null;
  const targetOpacity = store ? 0.95 : 0.88;
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

/** Ảnh nền toàn màn hình theo tab đang mở, kết hợp Aurora chất lỏng phát quang và lớp làm tối dịu mắt. */
export const LibraryBackdrop = memo(function LibraryBackdrop({ url, fallbackUrl, store }: BackdropProps) {
  const { reduceMotion } = useMotion();
  const [storeAnim] = useState(() => new Animated.Value(store ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(storeAnim, {
      toValue: store ? 1 : 0,
      duration: reduceMotion ? 0 : TAB_MOTION_MS,
      easing: TAB_MOTION_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, store, storeAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Lớp Aurora chất lỏng phát quang xuyên thấu qua các bề mặt kính */}
      <LiquidAmbientAurora active opacity={0.85} />

      {/* 2. Ảnh nền game / store nếu có */}
      <BackdropImage url={url} fallbackUrl={fallbackUrl} store={store} />

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: storeAnim,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(5,10,17,0.60)', 'rgba(5,10,17,0.25)', 'transparent', 'rgba(5,10,17,0.18)']}
          locations={[0, 0.38, 0.73, 1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(5,10,17,0.25)', 'transparent', 'rgba(5,10,17,0.08)', 'rgba(5,10,17,0.70)']}
          locations={[0, 0.28, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: storeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(8,12,18,0.62)', 'rgba(8,12,18,0.28)', 'rgba(8,12,18,0.04)', 'rgba(8,12,18,0.22)']}
          locations={[0, 0.47, 0.76, 1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(8,12,18,0.32)', 'rgba(8,12,18,0.02)', 'rgba(8,12,18,0.60)']}
          locations={[0, 0.33, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

/**
 * Nền tab PC: hình hoa xanh kiểu desktop Windows 11, vẽ bằng gradient nên không cần ảnh.
 * Phủ kín trên ảnh game và mờ dần vào/ra khi đổi tab.
 */
export const PcWallpaper = memo(function PcWallpaper({ visible }: { visible: boolean }) {
  const { width, height } = useUi();
  const { reduceMotion } = useMotion();
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));

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
        colors={['#020b24', '#06265f', '#0a4fb8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {petal(width * 0.62, width * 0.44, -height * 0.18, '-24deg', ['rgba(0,120,255,0.85)', 'rgba(0,70,190,0.15)'])}
      {petal(width * 0.5, width * 0.6, height * 0.12, '38deg', ['rgba(120,200,255,0.9)', 'rgba(20,110,235,0.2)'])}
      {petal(width * 0.46, width * 0.3, height * 0.34, '-52deg', ['rgba(0,90,230,0.8)', 'rgba(0,40,130,0.1)'])}
      {petal(width * 0.34, width * 0.7, height * 0.5, '12deg', ['rgba(170,225,255,0.75)', 'rgba(40,130,240,0.1)'])}
      <LinearGradient
        colors={['rgba(2,8,22,0.86)', 'rgba(2,8,22,0.4)', 'rgba(2,8,22,0.08)', 'rgba(2,8,22,0.32)']}
        locations={[0, 0.4, 0.74, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(2,8,22,0.4)', 'rgba(2,8,22,0)', 'rgba(2,8,22,0.78)']}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

export function StoreLoading() {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: s(4), paddingTop: s(8) }}>
      <View style={{ marginBottom: s(12), gap: s(8) }}>
        <Skeleton width={s(176)} height={s(20)} radius={s(4)} />
        <Skeleton width={s(288)} height={s(12)} radius={s(4)} tone={0.07} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(10), overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <Skeleton key={item} width={item === 0 ? s(212) : s(124)} height={item === 0 ? s(118) : s(80)} radius={s(12)} tone={0.09} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: s(10), marginTop: s(10), height: s(70) }}>
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} height={s(70)} radius={s(12)} tone={0.08} style={{ flex: item === 0 ? 1.25 : 1 }} />
        ))}
      </View>
    </View>
  );
}

export function LibrarySkeleton() {
  const { s } = useUi();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: s(12), paddingBottom: s(16) }}>
        <Skeleton width={s(288)} height={s(80)} radius={s(12)} />
        <Skeleton width={s(160)} height={s(40)} radius={s(20)} />
      </View>
      <View style={{ height: s(122), flexDirection: 'row', alignItems: 'flex-end', gap: s(12) }}>
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} width={item === 0 ? s(288) : s(88)} height={item === 0 ? s(112) : s(88)} radius={s(16)} tone={0.08} style={item ? { marginBottom: s(8) } : undefined} />
        ))}
      </View>
    </View>
  );
}

function RoundIcon({ children }: { children: React.ReactNode }) {
  const { s } = useUi();
  return (
    <View style={{
      width: s(54), height: s(54), borderRadius: s(16), alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
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
        <T size={12} color={colors.text3} leading={1.6} style={{ marginTop: s(6), textAlign: 'center' }}>{message}</T>
        <Press onPress={onRetry} style={[styles.whiteButton, { marginTop: s(14), height: s(40), paddingHorizontal: s(18), borderRadius: s(20), gap: s(8) }]}>
          <RefreshCw size={s(14)} color="#0a111c" strokeWidth={2.2} />
          <T size={12} weight="bold" color="#0a111c">Thử lại</T>
        </Press>
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
        <T size={12} color={colors.text3} leading={1.6} style={{ marginTop: s(6), textAlign: 'center' }}>
          {error || warning || 'Mở Steam trên máy tính để đồng bộ thư viện rồi thử lại.'}
        </T>
        <View style={{ flexDirection: 'row', gap: s(12), marginTop: s(16) }}>
          <Press onPress={onOpenPc} style={[styles.whiteButton, { height: s(40), paddingHorizontal: s(18), borderRadius: s(20), gap: s(8) }]}>
            <Monitor size={s(14)} color="#0a111c" strokeWidth={2.2} />
            <T size={12} weight="bold" color="#0a111c">Mở máy tính</T>
          </Press>
          <Press
            onPress={onRetry}
            disabled={refreshing}
            accessibilityLabel="Thử lại"
            style={{
              width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.09)',
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

const styles = StyleSheet.create({
  whiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
});

