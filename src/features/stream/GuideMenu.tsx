// Menu Guide: mở bằng nút Home của tay cầm (hoặc nút trên thanh stream).
// Tab game đang chạy, thiết bị đã nối, tài khoản; hành động: Home, chụp ảnh,
// sao chép (clipboard hai chiều với PC), tải lại, thoát game. Bản native của
// components/StreamGuideMenu.tsx.
//
// Tay cầm điều khiển menu này bằng D-pad/A/B (PC nhận trạng thái trung tính khi
// menu mở), chuột/cảm ứng dùng như thường.

import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import {
  Bluetooth, Camera, Check, ClipboardCopy, Copy, Gamepad2, Headphones, Home, Layers3, LogOut, RotateCw, UserRound, X, type LucideIcon,
} from 'lucide-react-native';
import { addListener, exportFrame, releaseFrame } from 'jetsona-input';

import { KIND_LABEL, useInputDevices } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { PC_ROUTES, pcFetch, pcPostJson } from '@/lib/pc-api';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type RunningGame = {
  id: string;
  title: string;
  source: string;
  artworkUrl: string | null;
  heroUrl: string | null;
  active: boolean;
  paused: boolean;
  processCount: number;
};

type Section = 'games' | 'devices' | 'profile';
type Action = { id: string; label: string; icon: LucideIcon; section?: Section; danger?: boolean; run?: () => void };

async function gameRuntime(action: 'focus' | 'quit', gameId: string | null) {
  await pcPostJson(PC_ROUTES.gameRuntime, { action, gameId: gameId ?? '' }, 'Không điều khiển được game.');
}

export function GuideMenu({
  open, profile, hasFrame, onClose, onHome, onReload, onSwitched, onExitGame,
}: {
  open: boolean;
  profile: { name: string; avatarUrl: string | null } | null;
  /** Đã giữ được một khung hình để chụp (grabFrame lúc mở menu). */
  hasFrame: boolean;
  onClose: () => void;
  onHome: () => void;
  onReload: () => void;
  onSwitched: () => void;
  onExitGame: () => void;
}) {
  const { s, insets, width } = useUi();
  const fade = useRef(new Animated.Value(0)).current;
  const { devices } = useInputDevices();
  const [section, setSection] = useState<Section>('games');
  const [games, setGames] = useState<RunningGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  // D-pad: hàng 0 = nội dung (danh sách game), hàng 1 = thanh tác vụ.
  const [row, setRow] = useState<0 | 1>(1);
  const [focus, setFocus] = useState(0);

  const loadGames = useCallback(async () => {
    setLoadingGames(true);
    try {
      const response = await pcFetch(PC_ROUTES.gameRuntime, { cache: 'no-store' });
      const data = await response.json().catch(() => null) as { ok?: boolean; games?: RunningGame[]; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Không đọc được game đang chạy.');
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoadingGames(false);
    }
  }, []);

  // Đọc danh sách game một lần mỗi lần mở menu; không có vòng lặp.
  useEffect(() => {
    if (!open) return;
    setSection('games');
    setShot(null);
    setMessage(null);
    setConfirmExit(false);
    setRow(1);
    setFocus(0);
    void loadGames();
    Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => { fade.setValue(0); releaseFrame(); };
  }, [fade, loadGames, open]);

  const run = useCallback(async (key: string, task: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      await task();
      if (success) setMessage(success);
    } catch (error) {
      setMessage((error as Error).message || 'Tác vụ chưa hoàn thành.');
    } finally {
      setBusy(null);
    }
  }, [busy]);

  const takeScreenshot = () => void run('shot', async () => {
    if (!hasFrame) throw new Error('Khung hình chưa sẵn sàng để chụp.');
    const base64 = await exportFrame(1920);
    if (!base64) throw new Error('Không mã hóa được ảnh chụp.');
    setShot(base64);
    try {
      await Clipboard.setImageAsync(base64);
      setMessage('Đã chụp và sao chép ảnh.');
    } catch {
      setMessage('Đã chụp. Chọn Sao chép để thử lại.');
    }
  });

  // Clipboard: kéo từ PC về máy này, hoặc đẩy từ máy này lên PC.
  const pullClipboard = () => void run('pull', async () => {
    const response = await pcFetch(PC_ROUTES.clipboard, { cache: 'no-store' });
    const data = await response.json().catch(() => null) as { ok?: boolean; text?: string; error?: string } | null;
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Không đọc được clipboard của máy tính.');
    if (typeof data.text === 'string' && data.text) {
      await Clipboard.setStringAsync(data.text);
      setMessage('Đã sao chép từ máy tính.');
    } else {
      setMessage('Clipboard của máy tính đang trống.');
    }
  });
  const pushClipboard = () => void run('push', async () => {
    const text = await Clipboard.getStringAsync();
    if (!text) throw new Error('Clipboard của máy này đang trống.');
    await pcPostJson(PC_ROUTES.clipboard, { text }, 'Không gửi được clipboard lên máy tính.');
    setMessage('Đã gửi clipboard lên máy tính.');
  });

  const activeGame = games.find((game) => game.active) ?? null;
  const actions: Action[] = useMemo(() => [
    { id: 'home', label: 'Home', icon: Home, run: onHome },
    { id: 'games', label: 'Tab game', icon: Layers3, section: 'games' },
    { id: 'shot', label: 'Chụp ảnh', icon: Camera, run: takeScreenshot },
    { id: 'pull', label: 'Lấy clipboard', icon: ClipboardCopy, run: pullClipboard },
    { id: 'push', label: 'Gửi clipboard', icon: Copy, run: pushClipboard },
    { id: 'devices', label: 'Thiết bị', icon: Gamepad2, section: 'devices' },
    { id: 'reload', label: 'Tải lại', icon: RotateCw, run: onReload },
    { id: 'profile', label: 'Tài khoản', icon: UserRound, section: 'profile' },
    { id: 'exit', label: 'Thoát game', icon: LogOut, danger: true, run: () => setConfirmExit(true) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [hasFrame, onHome, onReload, busy]);

  const switchGame = (game: RunningGame) => void run(`game:${game.id}`, async () => {
    await gameRuntime('focus', game.id);
    onSwitched();
  });

  const exitGame = () => void run('exit', async () => {
    await gameRuntime('quit', activeGame?.id ?? null);
    onExitGame();
  });

  const activate = (action: Action) => {
    if (action.section) setSection(action.section);
    else action.run?.();
  };

  // Điều khiển bằng tay cầm.
  const stateRef = useRef({ row, focus, section, games, actions, confirmExit, shot });
  stateRef.current = { row, focus, section, games, actions, confirmExit, shot };
  useEffect(() => {
    if (!open) return;
    return addListener('onGamepadButton', (event) => {
      if (!event.down) return;
      const current = stateRef.current;
      if (event.button === 'b' || event.button === 'guide') {
        if (current.shot) setShot(null);
        else if (current.confirmExit) setConfirmExit(false);
        else onClose();
        return;
      }
      if (current.confirmExit) {
        if (event.button === 'a') exitGame();
        return;
      }
      const count = current.row === 1 ? current.actions.length : current.games.length;
      if (event.button === 'left') setFocus((value) => Math.max(0, value - 1));
      else if (event.button === 'right') setFocus((value) => Math.min(Math.max(0, count - 1), value + 1));
      else if (event.button === 'up' && current.section === 'games') { setRow(0); setFocus(0); }
      else if (event.button === 'down') { setRow(1); setFocus(0); }
      else if (event.button === 'a') {
        if (current.row === 1) {
          const action = current.actions[current.focus];
          if (action) activate(action);
        } else {
          const game = current.games[current.focus];
          if (game) switchGame(game);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const connected = devices;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} accessibilityViewIsModal>
      <Press
        onPress={onClose}
        accessibilityLabel="Đóng menu và tiếp tục game"
        style={[styles.close, { top: s(12) + insets.top, right: s(16) + insets.right, width: s(36), height: s(36), borderRadius: s(18) }]}
      >
        <X size={s(16)} color={colors.text3} />
      </Press>

      <View style={{ flex: 1, paddingHorizontal: s(16) + insets.left, paddingTop: s(14) + insets.top, paddingBottom: s(84) + insets.bottom, justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: s(960), alignSelf: 'center' }}>
          {section === 'games' ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(16), marginBottom: s(12) }}>
                <View>
                  <T size={22} weight="semibold" tracking={-0.02}>Game đang chạy</T>
                  <T size={11.4} color="rgba(255,255,255,0.48)" style={{ marginTop: s(4) }}>Chọn một game để chuyển hình và điều khiển sang game đó.</T>
                </View>
                <T size={11.4} color="rgba(255,255,255,0.42)" tabular>{games.length} tab</T>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(12), paddingBottom: s(8) }}>
                {loadingGames && !games.length ? (
                  <View style={[styles.empty, { height: s(128), minWidth: width - s(64), borderRadius: s(16) }]}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.45)" />
                    <T size={11.4} color="rgba(255,255,255,0.45)" style={{ marginTop: s(8) }}>Đang đọc phiên game</T>
                  </View>
                ) : games.length ? games.map((game, index) => {
                  const art = game.heroUrl || game.artworkUrl;
                  const focused = row === 0 && focus === index;
                  return (
                    <Press
                      key={game.id}
                      disabled={Boolean(busy)}
                      onPress={() => switchGame(game)}
                      pressScale={0.98}
                      style={{
                        width: s(256), height: s(136), borderRadius: s(16), overflow: 'hidden', borderWidth: focused || game.active ? 2 : 1,
                        borderColor: focused ? colors.white : game.active ? 'rgba(159,138,255,0.8)' : 'rgba(255,255,255,0.12)', backgroundColor: '#171a23',
                      }}
                    >
                      {art ? <Img source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(9,11,17,0.45)' }]} />
                      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: s(14) }}>
                        <T size={14} weight="semibold" numberOfLines={1}>{game.title}</T>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(4) }}>
                          {busy === `game:${game.id}` ? <ActivityIndicator size="small" color={colors.text3} /> : game.active ? <Check size={s(12)} color="#b9adff" /> : <Layers3 size={s(12)} color={colors.text3} />}
                          <T size={10} color="rgba(255,255,255,0.58)">{game.active ? 'Đang hiển thị' : game.paused ? 'Đang giữ, đã pause' : 'Đang chạy nền'}</T>
                        </View>
                      </View>
                    </Press>
                  );
                }) : (
                  <View style={[styles.empty, { height: s(128), minWidth: width - s(64), borderRadius: s(16) }]}>
                    <Layers3 size={s(24)} color="rgba(255,255,255,0.32)" />
                    <T size={13} weight="medium" color="rgba(255,255,255,0.7)" style={{ marginTop: s(8) }}>Chưa tìm thấy game đang chạy</T>
                    <T size={10.4} color="rgba(255,255,255,0.38)" style={{ marginTop: s(4) }}>Game mở từ thư viện sẽ xuất hiện tại đây.</T>
                  </View>
                )}
              </ScrollView>
            </View>
          ) : section === 'devices' ? (
            <View>
              <T size={22} weight="semibold" tracking={-0.02}>Thiết bị đã kết nối</T>
              <T size={11.4} color="rgba(255,255,255,0.48)" style={{ marginTop: s(4) }}>Pin chỉ hiện khi thiết bị báo được cho Android.</T>
              <View style={{ marginTop: s(16), flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {connected.length ? connected.map((device) => {
                  const Icon = device.bluetooth && device.kind !== 'headset' ? Bluetooth : device.kind === 'headset' ? Headphones : KIND_ICONS[device.kind];
                  return (
                    <View key={device.id} style={[styles.deviceRow, { width: '49%', minHeight: s(56), borderRadius: s(16), paddingHorizontal: s(14), gap: s(12) }]}>
                      <View style={{ width: s(36), height: s(36), borderRadius: s(12), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' }}>
                        <Icon size={s(16)} color="#b9adff" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T size={12} weight="semibold" color="rgba(255,255,255,0.82)" numberOfLines={1}>{device.name}</T>
                        <T size={10} color="rgba(255,255,255,0.42)" style={{ marginTop: s(2) }}>{KIND_LABEL[device.kind]}</T>
                      </View>
                      <T size={11} weight="semibold" color="rgba(255,255,255,0.62)" tabular>{device.battery === null ? 'Đã nối' : `${Math.round(device.battery * 100)}%`}</T>
                    </View>
                  );
                }) : (
                  <View style={[styles.empty, { width: '100%', minHeight: s(110), borderRadius: s(16) }]}>
                    <T size={12} color="rgba(255,255,255,0.45)">Chưa có thiết bị ngoài nào được Android nhận diện.</T>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.deviceRow, { alignSelf: 'center', maxWidth: s(448), width: '100%', borderRadius: s(16), padding: s(20), flexDirection: 'column', alignItems: 'center' }]}>
              <View style={{ width: s(64), height: s(64), borderRadius: s(32), overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                {profile?.avatarUrl ? <Img source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <UserRound size={s(28)} color="rgba(255,255,255,0.55)" />}
              </View>
              <T size={18} weight="semibold" style={{ marginTop: s(12) }}>{profile?.name || 'Người điều khiển'}</T>
              <T size={12} color="rgba(255,255,255,0.45)" style={{ marginTop: s(4) }}>Đang điều khiển phiên này</T>
            </View>
          )}
        </View>

        {message ? (
          <View style={[styles.toast, { alignSelf: 'center', marginTop: s(8), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(6) }]}>
            <T size={11} color="rgba(255,255,255,0.62)" style={{ textAlign: 'center' }}>{message}</T>
          </View>
        ) : null}
      </View>

      <View style={[styles.nav, { bottom: s(10) + insets.bottom, borderRadius: s(16), padding: s(6), gap: s(2), maxWidth: width - s(16) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(2) }}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            const selected = action.section === section;
            const focused = row === 1 && focus === index;
            return (
              <Press
                key={action.id}
                disabled={Boolean(busy)}
                onPress={() => activate(action)}
                pressScale={0.96}
                accessibilityLabel={action.label}
                style={{
                  minWidth: s(64), alignItems: 'center', justifyContent: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(6), borderRadius: s(12),
                  backgroundColor: selected ? 'rgba(255,255,255,0.12)' : 'transparent', borderWidth: focused ? 2 : 0, borderColor: colors.white,
                }}
              >
                {busy === action.id ? <ActivityIndicator size="small" color={colors.text2} /> : (
                  <Icon size={s(16)} color={action.danger ? 'rgba(252,165,165,0.78)' : selected ? colors.white : 'rgba(255,255,255,0.52)'} />
                )}
                <T size={9} weight="medium" color={action.danger ? 'rgba(252,165,165,0.78)' : selected ? colors.white : 'rgba(255,255,255,0.52)'} numberOfLines={1}>{action.label}</T>
              </Press>
            );
          })}
        </ScrollView>
      </View>

      {shot ? (
        <View style={[StyleSheet.absoluteFill, styles.modal, { padding: s(16) }]}>
          <View style={{ width: '100%', maxWidth: s(640), overflow: 'hidden', borderRadius: s(16), backgroundColor: '#11151d', borderWidth: 1, borderColor: colors.line }}>
            <Img source={{ uri: `data:image/png;base64,${shot}` }} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: 'rgba(0,0,0,0.4)' }} contentFit="contain" transition={0} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(12), padding: s(12) }}>
              <T size={11} color="rgba(255,255,255,0.55)" style={{ flex: 1 }}>Ảnh được giữ cho tới khi đóng menu.</T>
              <Press onPress={() => setShot(null)} style={{ height: s(36), paddingHorizontal: s(12), justifyContent: 'center', borderRadius: s(12) }}>
                <T size={11} color="rgba(255,255,255,0.6)">Đóng</T>
              </Press>
              <Press
                onPress={() => void run('copy', async () => { await Clipboard.setImageAsync(shot); }, 'Đã sao chép ảnh.')}
                style={{ height: s(36), paddingHorizontal: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8), borderRadius: s(12), backgroundColor: '#8f74ff' }}
              >
                <Copy size={s(14)} color={colors.white} />
                <T size={11} weight="semibold">Sao chép</T>
              </Press>
            </View>
          </View>
        </View>
      ) : null}

      {confirmExit ? (
        <View style={[StyleSheet.absoluteFill, styles.modal, { padding: s(16) }]}>
          <View style={{ width: '100%', maxWidth: s(384), alignItems: 'center', borderRadius: s(16), padding: s(20), backgroundColor: '#14171f', borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: s(44), height: s(44), borderRadius: s(14), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,0.1)' }}>
              <LogOut size={s(20)} color="#fca5a5" />
            </View>
            <T size={15} weight="semibold" style={{ marginTop: s(12) }}>Thoát game và dừng stream?</T>
            <T size={11.4} color="rgba(255,255,255,0.48)" leading={1.55} style={{ marginTop: s(6), textAlign: 'center' }}>
              Game đang hiển thị sẽ đóng. Các game khác trong Tab game vẫn được giữ.
            </T>
            <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(16) }}>
              <Press onPress={() => setConfirmExit(false)} style={{ height: s(40), paddingHorizontal: s(16), justifyContent: 'center', borderRadius: s(12) }}>
                <T size={11.4} weight="semibold" color="rgba(255,255,255,0.6)">Hủy</T>
              </Press>
              <Press onPress={exitGame} style={{ height: s(40), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', gap: s(8), borderRadius: s(12), backgroundColor: 'rgba(239,68,68,0.85)' }}>
                {busy === 'exit' ? <ActivityIndicator size="small" color={colors.white} /> : <LogOut size={s(14)} color={colors.white} />}
                <T size={11.4} weight="semibold">Thoát game</T>
              </Press>
            </View>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(7,10,16,0.82)', zIndex: 160, elevation: 160 },
  close: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  toast: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.36)' },
  nav: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(16,19,26,0.94)',
  },
  modal: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,10,16,0.88)', zIndex: 20 },
});
