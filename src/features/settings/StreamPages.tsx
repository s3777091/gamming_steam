// Năm trang cài đặt stream: Chất lượng, Hình ảnh, Độ trễ & độ mượt, Mạng, Trong
// lúc stream. Chữ và bảng lựa chọn dùng chung với web qua lib/stream-settings-ui.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, RadioTower, RotateCcw } from 'lucide-react-native';

import { LOADING_THEMES, loadingPhotoUrl } from '@/lib/loading-themes';
import { getLiveBorderEnabled, setLiveBorderEnabled } from '@/lib/stream-overlay-settings';
import { PROFILE_META, REGION_META, type StreamSettings } from '@/lib/stream-settings';
import {
  CODEC_GUIDANCE,
  CODEC_OPTIONS,
  FPS_GUIDANCE,
  frameRateChoice,
  friendlyError,
  LATENCY_GUIDANCE,
  LATENCY_OPTIONS,
  measureNetwork,
  PROFILE_ORDER,
  streamSettingsCopy,
  type NetworkResult,
} from '@/lib/stream-settings-ui';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ActionRow, ChoiceRow, ConfirmActionRow, InfoRow, PillButton, SettingsGroup, SliderRow, ToggleRow } from './controls';
import type { Notify, StreamSettingsDraft } from './useStreamSettingsDraft';

type PageProps = { draft: StreamSettingsDraft; settings: StreamSettings };

export function QualityPage({ draft, settings }: PageProps) {
  const { s } = useUi();
  const copy = streamSettingsCopy(draft.deviceClass);
  const guidance = copy.profileGuidance[settings.profile];
  return (
    <>
      <SettingsGroup title="Profile streaming">
        {PROFILE_ORDER.map((profile) => {
          const active = settings.profile === profile;
          const visual = copy.profileVisual[profile];
          return (
            <Press
              key={profile}
              onPress={() => draft.selectProfile(profile)}
              pressScale={0.995}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={{
                minHeight: s(52), flexDirection: 'row', alignItems: 'center', gap: s(14), paddingHorizontal: s(12), paddingVertical: s(8),
                borderRadius: s(8), backgroundColor: active ? 'rgba(31,111,235,0.16)' : 'transparent',
              }}
            >
              <View
                style={{
                  width: s(20), height: s(20), borderRadius: s(10), alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                  borderColor: active ? '#4c94ff' : 'rgba(255,255,255,0.25)', backgroundColor: active ? colors.primary : 'transparent',
                }}
              >
                {active ? <Check size={s(12)} color={colors.white} strokeWidth={2.4} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={12.8} color="rgba(255,255,255,0.9)">{PROFILE_META[profile].label}</T>
                <T size={10.2} color="rgba(255,255,255,0.45)" numberOfLines={1} style={{ marginTop: s(2) }}>{visual.note}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={10.2} weight="medium" color="rgba(255,255,255,0.72)">{visual.resolution} · {visual.fps}</T>
                <T size={10.2} color="rgba(255,255,255,0.45)">{copy.profileGuidance[profile].bitrate}</T>
              </View>
            </Press>
          );
        })}
      </SettingsGroup>

      <View style={[styles.guidance, { marginHorizontal: s(12), marginTop: s(12), padding: s(12), borderRadius: s(12), gap: s(8) }]}>
        <T size={10.6} color="rgba(255,255,255,0.75)" leading={1.5}><T size={10.6} weight="semibold">Hợp với: </T>{guidance.bestFor}</T>
        <T size={10.6} color="rgba(255,255,255,0.55)" leading={1.5}><T size={10.6} weight="semibold" color="rgba(255,255,255,0.75)">Đổi lại: </T>{guidance.tradeoff}</T>
        <T size={10.6} color="rgba(255,255,255,0.45)" leading={1.5}>{guidance.bitrateDetail}</T>
      </View>

      <SettingsGroup title="Cấu hình chuẩn">
        <ConfirmActionRow
          icon={RotateCcw}
          label="Khôi phục cài đặt tốt nhất"
          confirmLabel="Khôi phục mọi thông số?"
          detail={draft.hasDrift ? 'Đưa mọi thông số về cấu hình đã tinh chỉnh cho độ mượt và chất lượng.' : 'Bạn đang dùng đúng cấu hình chuẩn.'}
          disabled={!draft.hasDrift}
          onConfirm={draft.restoreDefaults}
        />
      </SettingsGroup>
    </>
  );
}

export function VideoPage({ draft, settings }: PageProps) {
  const copy = streamSettingsCopy(draft.deviceClass);
  const fps = frameRateChoice(settings);
  return (
    <>
      <SettingsGroup title="Hình ảnh">
        <ChoiceRow label="Độ phân giải" value={settings.resolution} options={copy.resolutionOptions} guidance={copy.resolutionGuidance[settings.resolution]} onChange={(value) => draft.update('resolution', value)} />
        <ChoiceRow
          label="Tốc độ khung hình" value={fps} options={copy.fpsOptions} guidance={FPS_GUIDANCE[fps]}
          onChange={(value) => draft.update('frame_rate', value === 'auto' ? null : Number(value) as StreamSettings['frame_rate'])}
        />
        <ChoiceRow label="Codec" value={settings.codec} options={CODEC_OPTIONS} guidance={CODEC_GUIDANCE[settings.codec]} onChange={(value) => draft.update('codec', value)} />
      </SettingsGroup>

      <SettingsGroup
        title="Bitrate"
        footnote={settings.bitrate_mode === 'fixed'
          ? 'Luôn chừa 20% băng thông; mức thực tế được giới hạn chống nghẽn: 720p 12 · 1080p 35 · 1440p 50 · 4K 80 Mbps.'
          : undefined}
      >
        <ToggleRow
          label="Bitrate cố định"
          detail={settings.bitrate_mode === 'fixed' ? 'Giữ mức Mbps bạn đặt; mạng hụt sẽ gây giật.' : 'Tự hạ bitrate khi mạng yếu để phiên không bị ngắt.'}
          checked={settings.bitrate_mode === 'fixed'}
          onChange={(checked) => draft.update('bitrate_mode', checked ? 'fixed' : 'adaptive')}
        />
        {settings.bitrate_mode === 'fixed' ? (
          <SliderRow label="Bitrate tối đa" value={settings.bitrate_mbps ?? 25} min={1} max={80} step={1} format={(value) => `${value} Mbps`} onChange={(value) => draft.update('bitrate_mbps', value)} />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="Màu sắc">
        <ToggleRow label="HDR" detail="Vùng sáng rộng hơn. Màn hình đang xem phải hỗ trợ HDR, nếu không màu sẽ nhạt." checked={settings.hdr === 'on'} onChange={(checked) => draft.update('hdr', checked ? 'on' : 'off')} />
        <ToggleRow label="Màu 10-bit" detail="Giảm vệt màu ở bầu trời và bóng tối, đổi lại giải mã nặng hơn." checked={settings.ten_bit === 'on'} onChange={(checked) => draft.update('ten_bit', checked ? 'on' : 'off')} />
      </SettingsGroup>
    </>
  );
}

export function LatencyPage({ draft, settings }: PageProps) {
  return (
    <>
      <SettingsGroup title="Độ trễ">
        <ChoiceRow label="Chế độ xử lý" value={settings.latency_mode} options={LATENCY_OPTIONS} guidance={LATENCY_GUIDANCE[settings.latency_mode]} onChange={(value) => draft.update('latency_mode', value)} />
      </SettingsGroup>
      <SettingsGroup title="Độ mượt">
        <ToggleRow label="Frame pacing" detail="Dàn đều thời điểm hiện frame để chuyển động ít rung." checked={settings.frame_pacing} onChange={(checked) => draft.update('frame_pacing', checked)} />
        <ToggleRow label="V-Sync phía máy xem" detail="Hết xé hình, đổi lại có thể thêm một nhịp chờ hiển thị." checked={settings.client_vsync === 'on'} onChange={(checked) => draft.update('client_vsync', checked ? 'on' : 'off')} />
        <ToggleRow label="Chất lượng động" detail="Mạng yếu thì hạ độ nét nén tạm thời, giữ nguyên kích thước màn hình." checked={settings.dynamic_resolution} onChange={(checked) => draft.update('dynamic_resolution', checked)} />
      </SettingsGroup>
    </>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: s(8), backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: s(12), paddingVertical: s(8) }}>
      <T size={9.2} color={colors.text4} tracking={0.12}>{label.toUpperCase()}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(4), marginTop: s(2) }}>
        <T size={16} weight="semibold" tabular>{value}</T>
        <T size={9.6} color="rgba(255,255,255,0.5)">{unit}</T>
      </View>
    </View>
  );
}

export function NetworkPage({ draft, settings, notify }: PageProps & { notify: Notify }) {
  const { s } = useUi();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<NetworkResult | null>(null);

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      setResult(await measureNetwork(draft.deviceClass));
    } catch (error) {
      notify('error', 'Không kiểm tra được kết nối', friendlyError(error, 'Vui lòng thử lại sau ít phút.'));
    } finally {
      setTesting(false);
    }
  };

  const recommended = result?.recommendation.profile;
  const region = REGION_META[settings.region];
  return (
    <>
      <SettingsGroup title="Vị trí">
        <InfoRow
          label="Khu vực đang xem"
          detail={streamSettingsCopy(draft.deviceClass).regionGuidance[settings.region]}
          value={<><T size={14}>{region.flag}</T><T size={12} color={colors.text2}>{region.label}</T></>}
        />
      </SettingsGroup>

      <SettingsGroup title="Kiểm tra kết nối" footnote="Đo 6 lần tới máy chủ Jetsona rồi tải thử 512 KB. Kết quả được lưu kèm thiết bị này.">
        <ActionRow
          icon={RadioTower}
          tone="accent"
          busy={testing}
          label={testing ? 'Đang đo kết nối…' : result ? 'Kiểm tra lại' : 'Kiểm tra mạng'}
          detail="Ping, jitter, packet loss và băng thông"
          onPress={() => void runTest()}
        />
      </SettingsGroup>

      {result ? (
        <View style={{ marginHorizontal: s(12), marginTop: s(12) }}>
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <Metric label="Ping" value={result.ping.toFixed(0)} unit="ms" />
            <Metric label="Jitter" value={result.jitter.toFixed(1)} unit="ms" />
            <Metric label="Mất gói" value={result.loss.toFixed(1)} unit="%" />
            <Metric label="Băng thông" value={result.bandwidth.toFixed(0)} unit="Mbps" />
          </View>
          <View style={[styles.recommendation, { marginTop: s(8), padding: s(12), borderRadius: s(12), gap: s(12) }]}>
            <View style={{ flex: 1 }}>
              <T size={12.2} weight="semibold">{result.recommendation.title}</T>
              <T size={10.2} color="rgba(255,255,255,0.55)" leading={1.5} style={{ marginTop: s(2) }}>{result.recommendation.detail}</T>
            </View>
            {recommended && recommended !== settings.profile ? (
              <PillButton tone="accent" onPress={() => draft.selectProfile(recommended)}>{`Dùng ${PROFILE_META[recommended].label}`}</PillButton>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Check size={s(14)} color="#8fbcff" />
                <T size={10.6} weight="medium" color="#8fbcff">Đang dùng</T>
              </View>
            )}
          </View>
        </View>
      ) : null}
    </>
  );
}

export function OverlayPage({ draft, settings }: PageProps) {
  const { s } = useUi();
  const [border, setBorder] = useState(true);
  useEffect(() => {
    void getLiveBorderEnabled().then(setBorder);
  }, []);
  return (
    <>
      <SettingsGroup title="Lớp phủ">
        <ToggleRow label="Performance HUD" detail="RTT, jitter, mất gói, đường ICE, bitrate và frame rớt, đọc trực tiếp từ WebRTC." checked={settings.hud_enabled} onChange={(checked) => draft.update('hud_enabled', checked)} />
        <ToggleRow label="Viền báo đang phát" detail="Viền xanh quanh màn hình khi có người đang xem cùng. Chỉ áp dụng trên thiết bị này." checked={border} onChange={(checked) => { setBorder(checked); void setLiveBorderEnabled(checked); }} />
      </SettingsGroup>

      <SettingsGroup title="Màn hình chờ kết nối" footnote="Ảnh từ Unsplash, tự luân phiên trong lúc đang kết nối.">
        {LOADING_THEMES.map((theme) => {
          const active = settings.loading_theme === theme.id;
          return (
            <Press
              key={theme.id}
              onPress={() => draft.update('loading_theme', theme.id)}
              pressScale={0.995}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={{ minHeight: s(52), flexDirection: 'row', alignItems: 'center', gap: s(14), paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(8), backgroundColor: active ? 'rgba(31,111,235,0.16)' : 'transparent' }}
            >
              <View style={{ width: s(72), height: s(36), flexDirection: 'row', overflow: 'hidden', borderRadius: s(6), backgroundColor: 'rgba(255,255,255,0.06)' }}>
                {theme.photos.map((photo) => (
                  <Img key={photo.image} source={{ uri: loadingPhotoUrl(photo) }} style={{ flex: 1, height: '100%' }} contentFit="cover" transition={0} />
                ))}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={12.8} color="rgba(255,255,255,0.9)" numberOfLines={1}>{theme.label}</T>
                <T size={10.2} color="rgba(255,255,255,0.45)" numberOfLines={1} style={{ marginTop: s(2) }}>{theme.detail}</T>
              </View>
              {active ? <Check size={s(16)} color={colors.accent} /> : null}
            </Press>
          );
        })}
      </SettingsGroup>
    </>
  );
}

const styles = StyleSheet.create({
  guidance: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76,148,255,0.25)',
    backgroundColor: 'rgba(31,111,235,0.1)',
  },
});
