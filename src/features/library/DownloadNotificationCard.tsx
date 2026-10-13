// Một lượt tải game Steam trong tab Thông báo: ảnh, trạng thái, thanh tiến trình thật
// (phần trăm, dung lượng, tốc độ, thời gian còn lại) đọc từ agent trên PC.

import { StyleSheet, View } from 'react-native';
import { CircleAlert, CircleCheck, Download, FileText, HardDrive, Pause, Play } from 'lucide-react-native';

import {
  type GameDownload,
  formatBytes,
  formatEta,
  formatSpeed,
  isDownloadActive,
} from '@/lib/steam-downloads';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type DownloadItem = { download: GameDownload; imageUrl: string | null };

const BAD = new Set(['failed', 'cancelled', 'manual']);

function tone(download: GameDownload): { text: string; bar: string; badge: string } {
  if (download.status === 'installed') return { text: colors.success, bar: colors.success, badge: 'rgba(74,222,128,0.14)' };
  if (BAD.has(download.status)) return { text: '#fecaca', bar: colors.danger, badge: 'rgba(248,113,113,0.14)' };
  if (download.status === 'config' || download.status === 'eula') return { text: colors.warning, bar: colors.warning, badge: 'rgba(251,191,36,0.14)' };
  if (download.status === 'paused') return { text: colors.text3, bar: colors.text3, badge: 'rgba(255,255,255,0.08)' };
  return { text: colors.accent, bar: colors.accent, badge: 'rgba(102,168,255,0.12)' };
}

function meta(download: GameDownload): string {
  if (download.status === 'installed') return 'Sẵn sàng để chơi';
  const parts: string[] = [];
  if (download.percent !== null) parts.push(`${download.percent}%`);
  if (download.total > 0 && download.status !== 'config') parts.push(`${formatBytes(download.downloaded)} / ${formatBytes(download.total)}`);
  if (download.status === 'config' && download.total > 0) parts.push(`Cần ${formatBytes(download.total)}`);
  const speed = formatSpeed(download.bytesPerSec);
  if (speed) parts.push(speed);
  const eta = formatEta(download.etaSec);
  if (eta) parts.push(eta);
  return parts.join('  /  ');
}

export function DownloadNotificationCard({ item, canControl, onPause, onResume, onOpenPrompt }: {
  item: DownloadItem;
  canControl: boolean;
  onPause: (appid: number) => void;
  onResume: (appid: number) => void;
  onOpenPrompt: (appid: number) => void;
}) {
  const { s } = useUi();
  const { download, imageUrl } = item;
  const colorsFor = tone(download);
  const asking = download.status === 'config' || download.status === 'eula';
  const running = download.status === 'downloading';
  const StatusIcon = download.status === 'installed' ? CircleCheck
    : BAD.has(download.status) ? CircleAlert
      : asking ? (download.status === 'config' ? HardDrive : FileText)
        : Download;
  const percent = download.percent ?? 0;
  const showBar = download.percent !== null && !BAD.has(download.status) && download.status !== 'config';
  const details = meta(download);

  return (
    <View style={[styles.card, { padding: s(12), borderRadius: s(14), gap: s(12) }]}>
      <View style={[styles.thumb, { width: s(96), height: s(54), borderRadius: s(8) }]}>
        {imageUrl ? <Img source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
        {isDownloadActive(download) && download.percent !== null && !asking ? (
          <View style={[styles.thumbBar, { height: s(3) }]}>
            <View style={{ width: `${percent}%`, height: '100%', backgroundColor: colorsFor.bar }} />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <View style={[styles.badge, { borderRadius: s(4), paddingHorizontal: s(5), paddingVertical: s(1.5), backgroundColor: colorsFor.badge }]}>
            <StatusIcon size={s(9)} color={colorsFor.text} strokeWidth={2} />
            <T size={8.5} weight="semibold" color={colorsFor.text} numberOfLines={1}>{download.label.toUpperCase()}</T>
          </View>
        </View>
        <T size={12} weight="semibold" color={colors.text} numberOfLines={1} style={{ marginTop: s(4) }}>
          {download.name ?? 'Trò chơi Steam'}
        </T>
        {showBar ? (
          <View style={[styles.track, { height: s(3), borderRadius: s(2), marginTop: s(6) }]}>
            <View style={{ width: `${percent}%`, height: '100%', borderRadius: s(2), backgroundColor: colorsFor.bar }} />
          </View>
        ) : null}
        {details ? <T size={9.5} color={colors.text3} tabular numberOfLines={1} style={{ marginTop: s(showBar ? 5 : 3) }}>{details}</T> : null}
        {download.error ? <T size={9.5} color="#fecaca" leading={1.4} numberOfLines={2} style={{ marginTop: s(3) }}>{download.error}</T> : null}
        {asking && !canControl ? <T size={9.5} color={colors.text3} style={{ marginTop: s(3) }}>Đang chờ người bấm tải trả lời.</T> : null}
      </View>

      {asking && canControl ? (
        <Press
          onPress={() => onOpenPrompt(download.appid)}
          accessibilityLabel={download.status === 'config' ? 'Chọn nơi cài đặt' : 'Xem điều khoản'}
          style={[styles.action, styles.actionPrimary, { height: s(30), paddingHorizontal: s(12), borderRadius: s(15) }]}
        >
          <T size={10.4} weight="semibold" color={colors.onAccent}>{download.status === 'config' ? 'Chọn' : 'Xem'}</T>
        </Press>
      ) : (running || download.status === 'paused') && canControl ? (
        <Press
          onPress={() => (running ? onPause(download.appid) : onResume(download.appid))}
          accessibilityLabel={running ? 'Tạm dừng' : 'Tiếp tục'}
          style={[styles.action, { width: s(32), height: s(32), borderRadius: s(16) }]}
        >
          {running
            ? <Pause size={s(14)} color={colors.text} fill={colors.text} />
            : <Play size={s(14)} color={colors.text} fill={colors.text} style={{ marginLeft: s(1) }} />}
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102,168,255,0.28)',
    backgroundColor: 'rgba(102,168,255,0.06)',
  },
  thumb: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.07)' },
  thumbBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  track: { width: '100%', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
  action: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(255,255,255,0.07)' },
  actionPrimary: { borderColor: colors.accent, backgroundColor: colors.accent },
});
