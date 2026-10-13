// Giao diện lượt tải game Steam: vòng tiến trình trên nút chính, dòng trạng thái
// dưới logo và hộp đồng ý điều khoản. Dữ liệu đến thẳng từ PC qua DataChannel
// (features/library/useSteamDownloads.ts).

import { Pressable, StyleSheet, View } from 'react-native';
import { ExternalLink, FileText, X } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { openExternal } from '@/lib/open-external';
import { type GameDownload, formatBytes, formatEta, formatSpeed } from '@/lib/steam-downloads';
import { colors } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

/** Trạng thái còn đang diễn ra: nút chính hiện vòng tiến trình thay vì nút Cài đặt. */
export function downloadInProgress(download: GameDownload | null): boolean {
  return Boolean(download && ['preparing', 'eula', 'downloading', 'working', 'queued', 'paused', 'installed'].includes(download.status));
}

/** Vòng tiến trình vẽ quanh nút tròn; percent null = chưa biết (vòng mờ). */
export function ProgressRing({ size, percent }: { size: number; percent: number | null }) {
  const stroke = Math.max(2, size * 0.07);
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent)) / 100;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} fill="none" />
      {value > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.white}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length * value} ${length}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}

/** Dòng dưới logo: nhãn, phần trăm, dung lượng, tốc độ, thời gian còn lại. */
export function DownloadStatusLine({ download, canControl, onOpenEula }: {
  download: GameDownload;
  canControl: boolean;
  onOpenEula: () => void;
}) {
  const { s } = useUi();
  const failed = download.status === 'failed' || download.status === 'cancelled' || download.status === 'manual';
  const parts = [download.label];
  if (download.percent !== null && download.status !== 'installed') parts.push(`${download.percent}%`);
  if (download.total > 0 && download.status !== 'installed') {
    parts.push(`${formatBytes(download.downloaded)} / ${formatBytes(download.total)}`);
  }
  const speed = formatSpeed(download.bytesPerSec);
  if (speed) parts.push(speed);
  const eta = formatEta(download.etaSec);
  if (eta) parts.push(eta);

  return (
    <View style={{ marginTop: s(10), maxWidth: s(460), gap: s(6) }}>
      <T size={10.4} weight="medium" color={failed ? '#fecaca' : 'rgba(255,255,255,0.78)'} tabular numberOfLines={1}>
        {parts.join(' · ')}
      </T>
      {download.percent !== null && !failed && download.status !== 'installed' ? (
        <View style={[styles.track, { height: s(3), borderRadius: s(2) }]}>
          <View style={{ width: `${download.percent}%`, height: '100%', borderRadius: s(2), backgroundColor: download.status === 'paused' ? colors.text3 : colors.accent }} />
        </View>
      ) : null}
      {download.error ? (
        <T size={10} color={failed ? '#fecaca' : colors.text3} leading={1.45} numberOfLines={2}>{download.error}</T>
      ) : null}
      {download.status === 'eula' ? (
        canControl ? (
          <Press onPress={onOpenEula} style={[styles.eulaButton, { alignSelf: 'flex-start', gap: s(6), paddingHorizontal: s(12), height: s(28), borderRadius: s(14) }]}>
            <FileText size={s(12)} color={colors.onAccent} />
            <T size={10.4} weight="semibold" color={colors.onAccent}>Xem điều khoản</T>
          </Press>
        ) : (
          <T size={10} color={colors.text3}>Đang chờ người bấm tải đồng ý điều khoản của nhà phát hành.</T>
        )
      ) : null}
    </View>
  );
}

/** Steam bắt đồng ý EULA trước khi tải; người bấm Tải quyết định ngay trên điện thoại. */
export function EulaSheet({ download, onAnswer, onClose }: {
  download: GameDownload;
  onAnswer: (accept: boolean) => void;
  onClose: () => void;
}) {
  const { s, width } = useUi();
  useBack(() => { onClose(); });
  const eulas = download.eulas ?? [];
  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 70, elevation: 70 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,14,0.74)' }]} onPress={() => { playUiSound('back'); onClose(); }} />
        <View style={[styles.card, { width: Math.min(s(440), width - s(48)), borderRadius: s(22), padding: s(22) }]}>
          <Press onPress={onClose} sound="back" accessibilityLabel="Đóng" style={[styles.close, { top: s(10), right: s(10), width: s(30), height: s(30), borderRadius: s(15) }]}>
            <X size={s(14)} color={colors.text3} />
          </Press>
          <T size={15} weight="semibold" style={{ paddingRight: s(30) }}>Điều khoản của {download.name ?? 'trò chơi'}</T>
          <T size={11} color={colors.text3} leading={1.55} style={{ marginTop: s(6) }}>
            Nhà phát hành yêu cầu đồng ý các điều khoản dưới đây trước khi Steam tải game về máy tính.
          </T>
          <View style={{ marginTop: s(14), gap: s(6) }}>
            {eulas.map((eula, index) => (
              <Press
                key={eula.id}
                onPress={() => { if (eula.url) void openExternal(eula.url); }}
                disabled={!eula.url}
                pressScale={0.98}
                style={[styles.eulaRow, { gap: s(8), paddingHorizontal: s(12), paddingVertical: s(9), borderRadius: s(12) }]}
              >
                <FileText size={s(13)} color={colors.text2} />
                <T size={11} color={colors.text2} style={{ flex: 1 }} numberOfLines={1}>
                  {eulas.length > 1 ? `Điều khoản ${index + 1}` : 'Thỏa thuận người dùng (EULA)'}
                </T>
                {eula.url ? <ExternalLink size={s(12)} color={colors.text3} /> : null}
              </Press>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(10), marginTop: s(18) }}>
            <Press onPress={() => onAnswer(false)} sound="back" style={[styles.secondary, { height: s(38), paddingHorizontal: s(18), borderRadius: s(19) }]}>
              <T size={11.6} weight="semibold" color={colors.text2}>Huỷ cài đặt</T>
            </Press>
            <Press onPress={() => onAnswer(true)} sound="confirm" autoFocus style={[styles.primary, { height: s(38), paddingHorizontal: s(18), borderRadius: s(19) }]}>
              <T size={11.6} weight="semibold" color="#0a111c">Đồng ý & tải</T>
            </Press>
          </View>
        </View>
      </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
  card: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0d1520' },
  close: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  eulaRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.fillSoft },
  eulaButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent },
  secondary: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong },
  primary: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
