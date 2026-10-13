// Hộp thoại bật máy tính khi thư viện chưa kết nối được PC. Gửi Wake-on-LAN rồi
// THEO DÕI bằng sự kiện trạng thái nguồn (Realtime) — không hỏi thăm — qua các
// chặng: đã gửi tín hiệu -> Windows có mạng -> dịch vụ điều khiển sẵn sàng.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FocusLayer } from '@/features/gamepad/focus';
import { Check, Monitor, Power, X } from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { useDeviceStatus } from '@/features/devices/useDeviceStatus';
import { apiFetch } from '@/lib/api';
import { friendlyMessage } from '@/lib/friendly';
import { colors } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const WAKE_SLOW_MS = 90_000;
const WAKE_TIMEOUT_MS = 10 * 60_000;

type Phase = 'idle' | 'sending' | 'waiting' | 'ready' | 'failed';

export function PcPowerSheet({ onClose, onReady }: { onClose: () => void; onReady: () => void }) {
  const { s, width } = useUi();
  const status = useDeviceStatus();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const readyHandled = useRef(false);
  useBack(() => { onClose(); });

  // Máy đã bật sẵn (trạng thái đẩy về nói vậy) thì không cần gửi gì.
  const online = status.online === true && status.stage === 'ready';
  useEffect(() => {
    if (!online || readyHandled.current) return;
    readyHandled.current = true;
    setPhase('ready');
    const timer = setTimeout(onReady, 900);
    return () => clearTimeout(timer);
  }, [online, onReady]);

  // Hai mốc thời gian của chờ khởi động; không phải vòng lặp hỏi trạng thái.
  useEffect(() => {
    if (phase !== 'waiting') return;
    const slowTimer = setTimeout(() => setSlow(true), WAKE_SLOW_MS);
    const giveUp = setTimeout(() => {
      setPhase('failed');
      setError('Đã theo dõi 10 phút nhưng dịch vụ điều khiển chưa sẵn sàng. Kiểm tra trực tiếp Windows, mạng hoặc Wake-on-LAN.');
    }, WAKE_TIMEOUT_MS);
    return () => { clearTimeout(slowTimer); clearTimeout(giveUp); };
  }, [phase]);

  const wake = async () => {
    if (phase === 'sending' || phase === 'waiting') return;
    setPhase('sending');
    setError(null);
    setSlow(false);
    try {
      const response = await apiFetch('/api/wol/wake', { method: 'POST' });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setPhase('waiting');
    } catch (wakeError) {
      setPhase('failed');
      setError(friendlyMessage((wakeError as Error).message));
    }
  };

  const title = phase === 'ready' ? 'Máy đã sẵn sàng'
    : phase === 'waiting' ? (slow ? 'Máy khởi động lâu hơn bình thường' : 'Đang chờ máy khởi động…')
      : phase === 'sending' ? 'Đang gửi tín hiệu bật máy…'
        : 'Chưa kết nối được máy tính';
  const detail = phase === 'ready' ? 'Đang tải thư viện trò chơi…'
    : phase === 'waiting'
      ? (status.stage === 'network'
        ? 'Windows đã có mạng; đang chờ dịch vụ điều khiển khởi động. Không cần bấm lại.'
        : slow ? 'Tín hiệu đã gửi; vẫn đang theo dõi, không cần bấm lại.' : 'Thường mất 30–60 giây.')
      : phase === 'failed' ? error
        : 'Máy ở nhà có thể đang tắt hoặc đang ngủ. Bật máy để mở thư viện và chơi game.';

  return (
    <FocusLayer>
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 70, elevation: 70 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,14,0.74)' }]} onPress={() => { playUiSound('back'); onClose(); }} />
      <View style={[styles.card, { width: Math.min(s(400), width - s(48)), borderRadius: s(22), padding: s(22) }]}>
        <Press onPress={onClose} sound="back" accessibilityLabel="Đóng" style={[styles.close, { top: s(10), right: s(10), width: s(30), height: s(30), borderRadius: s(15) }]}>
          <X size={s(14)} color={colors.text3} />
        </Press>
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.badge, { width: s(56), height: s(56), borderRadius: s(18), borderColor: phase === 'ready' ? 'rgba(74,222,128,0.4)' : colors.line }]}>
            {phase === 'ready' ? <Check size={s(26)} color={colors.success} strokeWidth={2.4} /> : phase === 'sending' || phase === 'waiting'
              ? <ActivityIndicator color={colors.text2} /> : <Monitor size={s(24)} color={colors.text2} />}
          </View>
          <T size={16} weight="semibold" style={{ marginTop: s(14), textAlign: 'center' }}>{title}</T>
          <T size={11.4} color={phase === 'failed' ? '#fecaca' : colors.text3} leading={1.55} style={{ marginTop: s(6), textAlign: 'center' }}>{detail}</T>
          {phase === 'idle' || phase === 'failed' ? (
            <Press onPress={() => void wake()} sound="confirm" style={[styles.button, { marginTop: s(18), height: s(42), paddingHorizontal: s(22), borderRadius: s(21), gap: s(8) }]}>
              <Power size={s(15)} color="#0a111c" />
              <T size={12.4} weight="semibold" color="#0a111c">{phase === 'failed' ? 'Thử bật lại' : 'Bật máy tính'}</T>
            </Press>
          ) : null}
        </View>
      </View>
    </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0d1520' },
  close: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
