// "Ảnh chụp game" trong hồ sơ: các ảnh chụp từ menu Guide lúc đang stream, lưu
// trên ổ D của PC (xem lib/game-screenshots). Chạm một ảnh để xem lớn.

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Camera, X } from 'lucide-react-native';

import { FocusScroll } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import {
  listGameScreenshots,
  screenshotAuthHeaders,
  screenshotImageSource,
  type GameScreenshot,
} from '@/lib/game-screenshots';
import { colors } from '@/theme';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const MAX_SHOWN = 24;

function formatShotTime(modified: number): string {
  const date = new Date(modified);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} · ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Tên file là "<game> <ngày giờ>.png"; bỏ phần đuôi để hiện tên game. */
function shotTitle(name: string): string {
  return name.replace(/\.(png|jpe?g|webp)$/i, '').replace(/\s\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}(-[0-9a-f]{8})?$/i, '');
}

export function GameScreenshots() {
  const { s } = useUi();
  const [state, setState] = useState<{
    items: GameScreenshot[];
    headers: Record<string, string>;
    loading: boolean;
    error: string | null;
  }>({ items: [], headers: {}, loading: true, error: null });
  const [viewing, setViewing] = useState<GameScreenshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([listGameScreenshots(controller.signal), screenshotAuthHeaders()])
      .then(([items, headers]) => setState({ items, headers, loading: false, error: null }))
      .catch((error: Error) => {
        if (!controller.signal.aborted) {
          setState((current) => ({ ...current, loading: false, error: error.message || 'Không đọc được ảnh chụp.' }));
        }
      });
    return () => controller.abort();
  }, []);

  useBack(() => { setViewing(null); }, viewing !== null);

  const shown = state.items.slice(0, MAX_SHOWN);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <T size={11.5} weight="semibold" color="rgba(255,255,255,0.76)">Ảnh chụp game</T>
        {state.items.length > 0 ? (
          <T size={9.5} color={colors.text3} tabular>{state.items.length} ảnh</T>
        ) : null}
      </View>

      <FocusScroll
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: s(6), marginHorizontal: -s(4) }}
        contentContainerStyle={{ gap: s(8), paddingHorizontal: s(4), paddingVertical: s(6) }}
      >
        {state.loading
          ? [0, 1, 2].map((item) => <Skeleton key={item} width={s(150)} height={s(84)} radius={s(12)} tone={0.055} />)
          : shown.map((shot) => (
            <Press
              key={shot.path}
              onPress={() => setViewing(shot)}
              pressScale={0.96}
              accessibilityLabel={`Xem ${shot.name}`}
              style={[styles.thumb, { width: s(150), height: s(84), borderRadius: s(12) }]}
            >
              <Image
                source={screenshotImageSource(shot.path, state.headers)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={180}
                recyclingKey={shot.path}
              />
            </Press>
          ))}
        {!state.loading && shown.length === 0 ? (
          <View style={[styles.empty, { height: s(84), paddingHorizontal: s(12), gap: s(8), borderRadius: s(12) }]}>
            <Camera size={s(14)} color={colors.text3} />
            <T size={10.5} color={colors.text3}>
              {state.error || 'Chưa có ảnh nào. Mở menu Guide khi đang chơi và bấm Chụp ảnh.'}
            </T>
          </View>
        ) : null}
      </FocusScroll>

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)} supportedOrientations={['landscape', 'portrait']}>
        {viewing ? (
          <View style={styles.viewer}>
            <Image
              source={screenshotImageSource(viewing.path, state.headers)}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
            <View style={[styles.viewerBar, { top: s(14), left: s(18), right: s(18) }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={12.5} weight="semibold" numberOfLines={1}>{shotTitle(viewing.name)}</T>
                <T size={10} color="rgba(255,255,255,0.6)" tabular style={{ marginTop: s(2) }}>
                  {formatShotTime(viewing.modified)}
                </T>
              </View>
              <Press
                onPress={() => setViewing(null)}
                sound="back"
                accessibilityLabel="Đóng ảnh"
                style={[styles.close, { width: s(34), height: s(34), borderRadius: s(17) }]}
              >
                <X size={s(16)} color="#ffffff" />
              </Press>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerBar: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
