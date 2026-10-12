import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Monitor, RefreshCw, WifiOff } from 'lucide-react-native';

import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

/** Ảnh nền toàn màn hình theo tab đang mở, kèm lớp tối để chữ đọc được. */
export function LibraryBackdrop({ url, store }: { url: string | null | undefined; store: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {url ? (
        <Img
          key={url}
          source={{ uri: url }}
          style={[StyleSheet.absoluteFill, { opacity: store ? 1 : 0.8 }]}
          contentFit="cover"
          transition={560}
        />
      ) : null}
      {store ? (
        <>
          <LinearGradient
            colors={['rgba(5,10,17,0.82)', 'rgba(5,10,17,0.42)', 'rgba(5,10,17,0.06)', 'rgba(5,10,17,0.24)']}
            locations={[0, 0.38, 0.73, 1]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(5,10,17,0.42)', 'rgba(5,10,17,0)', 'rgba(5,10,17,0.16)', 'rgba(5,10,17,0.96)']}
            locations={[0, 0.28, 0.48, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={['rgba(8,12,18,0.92)', 'rgba(8,12,18,0.58)', 'rgba(8,12,18,0.18)', 'rgba(8,12,18,0.44)']}
            locations={[0, 0.47, 0.76, 1]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(8,12,18,0.58)', 'rgba(8,12,18,0.08)', 'rgba(8,12,18,0.80)']}
            locations={[0, 0.33, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  );
}

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
      width: s(48), height: s(48), borderRadius: s(12), alignItems: 'center', justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.07)',
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
        <RoundIcon><WifiOff size={s(20)} color="rgba(255,255,255,0.58)" /></RoundIcon>
        <T size={18} weight="semibold" tracking={-0.02} style={{ marginTop: s(12) }}>Không tải được Steam Store</T>
        <T size={12} color={colors.text3} leading={1.6} style={{ marginTop: s(6), textAlign: 'center' }}>{message}</T>
        <Press onPress={onRetry} style={[styles.whiteButton, { marginTop: s(12), height: s(40), paddingHorizontal: s(16), borderRadius: s(20), gap: s(8) }]}>
          <RefreshCw size={s(14)} color="#0a111c" />
          <T size={12} weight="semibold" color="#0a111c">Thử lại</T>
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
          {error ? <WifiOff size={s(20)} color="rgba(255,255,255,0.58)" /> : <Gamepad2 size={s(20)} color="rgba(255,255,255,0.58)" />}
        </RoundIcon>
        <T size={18} weight="semibold" tracking={-0.02} style={{ marginTop: s(12) }}>
          {error ? 'Chưa kết nối được máy tính' : warning ? 'Chưa đọc được thư viện Steam' : 'Chưa tìm thấy trò chơi có thể cài'}
        </T>
        <T size={12} color={colors.text3} leading={1.6} style={{ marginTop: s(6), textAlign: 'center' }}>
          {error || warning || 'Mở Steam trên máy tính để đồng bộ thư viện rồi thử lại.'}
        </T>
        <View style={{ flexDirection: 'row', gap: s(10), marginTop: s(12) }}>
          <Press onPress={onOpenPc} style={[styles.whiteButton, { height: s(40), paddingHorizontal: s(16), borderRadius: s(20), gap: s(8) }]}>
            <Monitor size={s(14)} color="#0a111c" />
            <T size={12} weight="semibold" color="#0a111c">Mở máy tính</T>
          </Press>
          <Press
            onPress={onRetry}
            disabled={refreshing}
            accessibilityLabel="Thử lại"
            style={{
              width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.07)',
              opacity: refreshing ? 0.55 : 1,
            }}
          >
            <RefreshCw size={s(14)} color="rgba(255,255,255,0.75)" />
          </Press>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  whiteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
