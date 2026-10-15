/**
 * Copy, option lists and Supabase calls shared by every screen that edits
 * stream settings: the desktop console dialog and the phone Cài đặt overlay.
 *
 * Both used to carry their own copy of these tables; two screens describing
 * the same resolution step in two different sentences is exactly how they
 * drift apart after a few edits.
 */

import { apiFetch } from '@/lib/api';
import { ensureClientDeviceId } from '@/lib/client-device';
import { emitStreamSettings } from '@/lib/stream-settings-events';
import {
  DEVICE_MAX_FRAME_RATE,
  RESOLUTION_META,
  RESOLUTION_ORDER,
  STREAM_SETTINGS_TABLE,
  tierWithinDeviceLimit,
  type LatencyMode,
  type Resolution,
  type StreamDeviceClass,
  type StreamProfile,
  type StreamSettings,
  type ViewerRegion,
} from '@/lib/stream-settings';
import { createClient } from '@/lib/supabase';

export type SettingsSelectOption<T extends string> = { value: T; label: string; description?: string };

type SelectOption<T extends string> = SettingsSelectOption<T>;

export type FrameRateChoice = 'auto' | '30' | '60' | '90' | '120' | '144';

export type NetworkRecommendation = {
  storedValue: string;
  /** The profile this measurement points at, so a screen can offer to apply it. */
  profile: StreamProfile;
  title: string;
  detail: string;
};

export type NetworkResult = {
  ping: number;
  jitter: number;
  loss: number;
  bandwidth: number;
  recommendation: NetworkRecommendation;
};

export const PROFILE_ORDER: StreamProfile[] = ['auto', 'competitive', 'balanced', 'quality', 'data_saver', 'long_haul'];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || !error || !('message' in error)) return '';
  return typeof error.message === 'string' ? error.message : '';
}

export { errorMessage as streamSettingsErrorMessage };

export function friendlyError(error: unknown, fallback: string): string {
  const message = errorMessage(error);
  if (message === 'Không kết nối được tới máy chủ.') {
    return 'Không kết nối được tới máy chủ. Hãy kiểm tra Internet rồi thử lại.';
  }
  // Lưu thiếu mất ĐÚNG cột đường truyền là kiểu hỏng tệ nhất ở màn hình này:
  // The schema still stores `ice_mode` for compatibility with existing rows.
  if (/ice_mode/i.test(message) && /column|schema cache/i.test(message)) {
    return 'Máy chủ chưa có cột cấu hình WebRTC nên chưa lưu được cài đặt. '
      + 'Hãy chạy migration mới nhất của Supabase rồi thử lại.';
  }
  if (/phone_stream_settings/i.test(message) && /relation|does not exist|schema cache|could not find/i.test(message)) {
    return 'Máy chủ chưa có bảng cài đặt cho điện thoại. '
      + 'Hãy chạy migration mới nhất của Supabase rồi thử lại.';
  }
  if (/Phiên đăng nhập đã hết hạn/i.test(message)) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tiếp.';
  }
  if (/row-level security|permission denied|not authorized|forbidden/i.test(message)) {
    return 'Tài khoản của bạn không có quyền thực hiện thay đổi này.';
  }
  if (/jwt|session|refresh token/i.test(message)) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tiếp.';
  }
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return 'Không thể kết nối tới máy chủ. Hãy kiểm tra Internet rồi thử lại.';
  }
  if (/duplicate key|already exists|unique constraint/i.test(message)) {
    return 'Thông tin này đã được sử dụng. Hãy chọn giá trị khác.';
  }
  return fallback;
}

export async function persistStreamSettings(
  settings: StreamSettings,
  deviceClass: StreamDeviceClass,
): Promise<void> {
  const supabase = createClient();
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');
  const { error } = await supabase
    .from(STREAM_SETTINGS_TABLE[deviceClass])
    .upsert(settings, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Tell a running stream (and any other open settings screen) to re-read its config. */
export function announceStreamSettings(settings: StreamSettings) {
  emitStreamSettings(settings);
}

/**
 * Trên điện thoại cùng tên preset là con số khác (xem `profileSettingsFor`):
 * Quality là 1080p60 ở 30 Mbps chứ không phải 4K ở 70. Nên cả câu chữ lẫn
 * ngưỡng băng thông của Quality phải là của preset điện thoại — hứa "4K" rồi
 * bấm vào lại ra 1080p là nói sai, còn đòi 55 Mbps cho một preset chỉ cần 40
 * là gợi ý thấp hơn mức đường truyền thật sự nuôi được. Các preset khác giống
 * PC nên ngưỡng cũng giống PC.
 */
function recommendPhoneProfile(ping: number, loss: number, bandwidth: number): NetworkRecommendation {
  if (loss > 2 || ping > 100 || bandwidth < 12) {
    return {
      storedValue: 'Data Saver, 720p60 (điện thoại)',
      profile: 'data_saver',
      title: 'Nên dùng Data Saver',
      detail: '720p, 60 FPS ở 8 Mbps sẽ ổn định hơn với độ trễ hoặc băng thông hiện tại.',
    };
  }
  if (ping < 35 && bandwidth >= 40) {
    return {
      storedValue: 'Quality, 1080p60 (điện thoại)',
      profile: 'quality',
      title: 'Có thể dùng Quality',
      detail: 'Đường truyền đủ cho preset 1080p, 60 FPS ở 30 Mbps. Auto có thể tận dụng panel độ phân giải cao hơn.',
    };
  }
  if (ping < 45 && bandwidth >= 32) {
    return {
      storedValue: 'Balanced, 1080p60 (điện thoại)',
      profile: 'balanced',
      title: 'Nên dùng Balanced',
      detail: '1080p, 60 FPS, tối đa 25 Mbps — tự hạ theo mạng nên ít giật khi Wi-Fi dao động.',
    };
  }
  return {
    storedValue: 'Auto, theo màn hình thiết bị',
    profile: 'auto',
    title: 'Nên giữ chế độ Auto',
    detail: 'Tự khớp màn điện thoại và tần số quét, hạ dần khi mạng dao động.',
  };
}

export function recommendNetworkProfile(
  ping: number,
  loss: number,
  bandwidth: number,
  deviceClass: StreamDeviceClass,
): NetworkRecommendation {
  if (deviceClass === 'phone') return recommendPhoneProfile(ping, loss, bandwidth);
  if (loss > 2 || ping > 100 || bandwidth < 12) {
    return {
      storedValue: 'Data Saver, 720p60',
      profile: 'data_saver',
      title: 'Nên dùng Data Saver',
      detail: '720p, 60 FPS sẽ ổn định hơn với độ trễ hoặc băng thông hiện tại.',
    };
  }
  if (ping < 35 && bandwidth >= 55) {
    return {
      storedValue: 'Quality, 4K60',
      profile: 'quality',
      title: 'Có thể dùng Quality',
      detail: 'Đường truyền hiện tại phù hợp với 4K, 60 FPS.',
    };
  }
  if (ping < 45 && bandwidth >= 32) {
    return {
      storedValue: 'Balanced, 1080p60',
      profile: 'balanced',
      title: 'Nên dùng Balanced',
      detail: '1080p, 60 FPS cân bằng tốt độ nét và độ ổn định.',
    };
  }
  return {
    storedValue: 'Auto, theo màn hình thiết bị',
    profile: 'auto',
    title: 'Nên giữ chế độ Auto',
    detail: 'Khớp số pixel và Hz màn hình hỗ trợ, tự điều chỉnh theo đường truyền.',
  };
}

/**
 * Ping, jitter, loss and bandwidth to the Jetsona server, logged against this
 * device so the history shows which network each result came from.
 */
export async function measureNetwork(deviceClass: StreamDeviceClass): Promise<NetworkResult> {
  const samples: number[] = [];
  let failed = 0;
  for (let index = 0; index < 6; index += 1) {
    const started = performance.now();
    try {
      const response = await apiFetch(`/api/network-test?t=${Date.now()}-${index}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('ping failed');
      await response.json();
      samples.push(performance.now() - started);
    } catch {
      failed += 1;
    }
  }
  if (!samples.length) throw new Error('Không kết nối được tới máy chủ.');

  const ping = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const jitter = samples.reduce((sum, value) => sum + Math.abs(value - ping), 0) / samples.length;
  const bytes = 512 * 1024;
  const downloadStarted = performance.now();
  const download = await apiFetch(`/api/network-test?bytes=${bytes}&t=${Date.now()}`, { cache: 'no-store' });
  if (!download.ok) throw new Error('bandwidth failed');
  await download.arrayBuffer();
  const seconds = Math.max(0.001, (performance.now() - downloadStarted) / 1000);
  const bandwidth = (bytes * 8) / seconds / 1_000_000;
  const loss = (failed / 6) * 100;
  const recommendation = recommendNetworkProfile(ping, loss, bandwidth, deviceClass);

  const supabase = createClient();
  const { data: auth } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const clientDeviceId = supabase ? await ensureClientDeviceId(supabase) : null;
  if (supabase && auth.user) {
    await supabase.from('network_test_results').insert({
      user_id: auth.user.id,
      client_device_id: clientDeviceId,
      ping_ms: ping,
      jitter_ms: jitter,
      packet_loss_percent: loss,
      estimated_bandwidth_mbps: bandwidth,
      recommended_profile: recommendation.storedValue,
    });
  }
  return { ping, jitter, loss, bandwidth, recommendation };
}

export const PROFILE_VISUAL: Record<StreamProfile, { title: string; resolution: string; fps: string; note: string; filter: string }> = {
  auto: {
    title: 'Auto',
    resolution: 'Tự động',
    fps: 'Tự động',
    note: 'Điều chỉnh theo màn hình và đường truyền',
    filter: 'contrast(1.02) saturate(0.96)',
  },
  competitive: {
    title: 'Competitive',
    resolution: '1080p',
    fps: '120 FPS',
    note: 'Ưu tiên phản hồi nhanh và chuyển động rõ',
    filter: 'contrast(1.15) saturate(0.9)',
  },
  balanced: {
    title: 'Balanced',
    resolution: '1080p',
    fps: '60 FPS',
    note: 'Ưu tiên nhịp hình ổn định và thao tác bám tay',
    filter: 'contrast(1.04) saturate(1)',
  },
  quality: {
    title: 'Quality',
    resolution: '4K',
    fps: '60 FPS',
    note: 'Giữ chi tiết và chiều sâu hình ảnh cao nhất',
    filter: 'contrast(1.08) saturate(1.08)',
  },
  data_saver: {
    title: 'Data Saver',
    resolution: '720p',
    fps: '60 FPS',
    note: 'Giảm dữ liệu khi mạng yếu hoặc có giới hạn',
    filter: 'contrast(0.94) saturate(0.78) blur(0.45px)',
  },
  long_haul: {
    title: 'Đường xa',
    resolution: 'Tự động',
    fps: 'Tự động',
    note: 'Cho người xem ở xa, qua đường truyền quốc tế',
    filter: 'contrast(1.02) saturate(0.94)',
  },
};

export const PROFILE_GUIDANCE: Record<StreamProfile, {
  resolution: string;
  fps: string;
  bitrate: string;
  bitrateDetail: string;
  bestFor: string;
  tradeoff: string;
}> = {
  auto: {
    resolution: 'Tự khớp với màn hình; mạng yếu chỉ hạ chất lượng nén.',
    fps: 'Theo Hz màn hình hỗ trợ (60/90/120/144), tự hạ khi mạng không đủ.',
    bitrate: 'Tự động',
    bitrateDetail: 'Theo dõi băng thông và chỉ dùng mức cần thiết.',
    bestFor: 'Phù hợp khi bạn đổi mạng hoặc đổi màn hình thường xuyên.',
    tradeoff: 'Chất lượng có thể thay đổi nhẹ trong lúc mạng dao động.',
  },
  competitive: {
    resolution: '1080p giữ hình đủ nét nhưng giảm tải mã hóa.',
    fps: '120 FPS làm chuyển động và thao tác nhanh rõ hơn.',
    bitrate: '45 Mbps',
    bitrateDetail: 'Cần đường truyền ổn định khoảng 55 Mbps trở lên.',
    bestFor: 'Tốt cho FPS, đối kháng và game cần phản xạ nhanh.',
    tradeoff: 'Ít chi tiết hơn 1440p/4K và dùng băng thông cao do 120 FPS.',
  },
  balanced: {
    resolution: '1080p giữ hình rõ nhưng giảm tải truyền và giải mã.',
    fps: '60 FPS đủ mượt cho phần lớn trò chơi.',
    bitrate: 'Tối đa 25 Mbps',
    bitrateDetail: 'Tự hạ theo mạng thực tế trong phiên để tránh nghẽn và giật chuột.',
    bestFor: 'Lựa chọn an toàn cho game hành động lẫn game cốt truyện.',
    tradeoff: 'Không sắc bằng 1440p/4K nhưng ổn định hơn khi chơi từ xa.',
  },
  quality: {
    resolution: '4K giữ chữ nhỏ, texture và cảnh xa rõ nhất.',
    fps: '60 FPS cân bằng độ mượt với lượng điểm ảnh lớn.',
    bitrate: '70 Mbps',
    bitrateDetail: 'Nên có mạng ổn định từ 85 Mbps và màn hình 4K.',
    bestFor: 'Tốt cho game điện ảnh, màn hình lớn và xem chi tiết.',
    tradeoff: 'Tốn băng thông nhất và có thể tăng độ trễ mã hóa.',
  },
  data_saver: {
    resolution: '720p giảm mạnh dữ liệu truyền trên mỗi khung hình.',
    fps: '60 FPS vẫn giữ chuyển động tương đối mượt.',
    bitrate: '8 Mbps',
    bitrateDetail: 'Hoạt động tốt từ khoảng 12 Mbps.',
    bestFor: 'Hợp với 4G/5G, Wi-Fi yếu hoặc gói mạng giới hạn.',
    tradeoff: 'Chữ nhỏ và texture sẽ mềm hơn, đặc biệt trên màn hình lớn.',
  },
  long_haul: {
    resolution: 'Tự khớp màn hình, giữ nguyên kích thước khi đường truyền hụt hơi.',
    fps: 'Tự chọn theo tần số quét và lượng bit còn dư.',
    bitrate: 'Tự động',
    bitrateDetail: 'Trừ sẵn phần độ trễ và mất gói ăn mất, thay vì chỉ nhìn băng thông.',
    bestFor: 'Hợp khi người xem ở nước ngoài — Trung Quốc, châu Âu, Mỹ.',
    tradeoff: 'Đệm thêm 80 ms để đổi lấy nhịp hình đều; không hợp game cần phản xạ.',
  },
};

// Chiều cao luôn được suy ra từ tỉ lệ màn hình thật của người dùng, nên không
// hứa một khung 16:9 cứng nữa — hứa vậy thì máy 16:10 hay ultrawide sẽ có viền
// đen trên dưới. Xem `streamGeometryFor`.
//
// Nhãn dựng từ `RESOLUTION_META` chứ không chép tay: thanh điều khiển lúc đang
// stream cũng bày đúng danh sách này, và hai chỗ mô tả cùng một bậc bằng hai
// câu khác nhau là cách chắc chắn nhất để chúng lệch nhau sau vài lần sửa.
export const RESOLUTION_OPTIONS: SelectOption<StreamSettings['resolution']>[] = RESOLUTION_ORDER.map(
  (value) => ({
    value,
    label: value === 'auto'
      ? RESOLUTION_META[value].label
      : `${RESOLUTION_META[value].label} · ${RESOLUTION_META[value].width}`,
    description: RESOLUTION_META[value].device,
  }),
);

export const REGION_GUIDANCE: Record<ViewerRegion, string> = {
  vn: 'Auto có thể chọn tới 4K/144 FPS nếu màn hình và băng thông cho phép.',
  cn: 'Auto sẽ giới hạn ở 1080p/60 để ưu tiên kết nối ổn định. Bậc và FPS bạn tự chọn vẫn được giữ nguyên.',
};

export const FPS_OPTIONS: SelectOption<FrameRateChoice>[] = [
  { value: 'auto', label: 'Tự động', description: 'Bám tần số quét màn hình' },
  { value: '30', label: '30 FPS', description: 'Tiết kiệm dữ liệu nhất' },
  { value: '60', label: '60 FPS', description: 'Mượt cho đa số trò chơi' },
  { value: '90', label: '90 FPS', description: 'Mượt hơn, tải tăng khoảng 50%' },
  { value: '120', label: '120 FPS', description: 'Phản hồi nhanh, cần màn hình 120 Hz' },
  { value: '144', label: '144 FPS', description: 'Tối đa độ mượt, tải rất cao' },
];

export const CODEC_OPTIONS: SelectOption<StreamSettings['codec']>[] = [
  { value: 'auto', label: 'Tự động', description: 'Chọn codec tốt nhất' },
  { value: 'av1', label: 'AV1', description: 'Hiệu quả nén cao' },
  { value: 'hevc', label: 'HEVC / H.265', description: 'Chất lượng cao' },
  { value: 'h264', label: 'H.264', description: 'Tương thích rộng' },
];

export const LATENCY_OPTIONS: SelectOption<LatencyMode>[] = [
  { value: 'smooth', label: 'Mượt', description: 'Bộ đệm lớn hơn, ít giật hình' },
  { value: 'balanced', label: 'Cân bằng', description: 'Phù hợp đa số trò chơi' },
  { value: 'ultra_low', label: 'Độ trễ cực thấp', description: 'Phản hồi nhanh cho game đối kháng' },
];

export const RESOLUTION_GUIDANCE: Record<StreamSettings['resolution'], string> = Object.fromEntries(
  RESOLUTION_ORDER.map((value) => [value, RESOLUTION_META[value].guidance]),
) as Record<StreamSettings['resolution'], string>;

export const FPS_GUIDANCE: Record<FrameRateChoice, string> = {
  auto: 'Khớp Hz màn hình hỗ trợ (60/90/120/144), yêu cầu chế độ phù hợp khi chơi và tự hạ FPS nếu băng thông đo được không đủ.',
  '30': 'Máy bạn sẽ giảm gần một nửa lượng khung hình so với 60 FPS để tiết kiệm mạng.',
  '60': 'Máy bạn sẽ có chuyển động mượt cho đa số trò chơi mà không tăng tải quá mức.',
  '90': 'Máy bạn sẽ phản hồi mượt hơn 60 FPS, đổi lại cần thêm băng thông và khả năng giải mã.',
  '120': 'Máy bạn sẽ giảm cảm giác trễ khi ngắm và xoay camera; màn hình nên hỗ trợ 120 Hz.',
  '144': 'Máy bạn sẽ ưu tiên độ mượt tối đa; chỉ có lợi rõ rệt trên màn hình 144 Hz.',
};

export const CODEC_GUIDANCE: Record<StreamSettings['codec'], string> = {
  auto: 'Máy bạn sẽ thử codec hiệu quả nhất mà cả máy chủ và trình duyệt đều giải mã được.',
  av1: 'Máy bạn sẽ giữ chất lượng tốt ở bitrate thấp hơn, nhưng cần phần cứng AV1 tương đối mới.',
  hevc: 'Máy bạn sẽ có hình đẹp hơn H.264 ở cùng bitrate; một số trình duyệt có thể không hỗ trợ.',
  h264: 'Máy bạn sẽ ưu tiên khả năng tương thích và giải mã nhanh, đổi lại tốn bitrate hơn.',
};

export const LATENCY_GUIDANCE: Record<LatencyMode, string> = {
  smooth: 'Đệm khoảng 80 ms trước khi hiện hình. Hợp khi mạng dao động mạnh hoặc xem từ xa.',
  balanced: 'Đệm khoảng 30 ms. Đủ hấp thụ dao động thường gặp mà thao tác vẫn bám tay.',
  ultra_low: 'Hiện frame gần như ngay khi nhận. Nhạy nhất, nhưng mạng chập chờn sẽ lộ ra thành giật.',
};

// ---------------------------------------------------------------------------
// Điện thoại
//
// Cùng các preset và bậc như trên nhưng nói bằng ngôn ngữ của màn nhỏ: "Tablet
// lớn, laptop" hay "4K · 70 Mbps" là sai sự thật khi đang cầm điện thoại, vì
// những preset ấy trên điện thoại đã là 1080p (xem `profileSettingsFor`).
// ---------------------------------------------------------------------------

const PHONE_PROFILE_VISUAL: Record<StreamProfile, typeof PROFILE_VISUAL[StreamProfile]> = {
  ...PROFILE_VISUAL,
  auto: {
    ...PROFILE_VISUAL.auto,
    note: 'Khớp số pixel và Hz màn hình thiết bị này',
  },
  competitive: {
    ...PROFILE_VISUAL.competitive,
    note: 'Phản hồi nhanh nhất cho màn 120 Hz',
  },
  quality: {
    ...PROFILE_VISUAL.quality,
    resolution: '1080p',
    note: '1080p với bitrate cao, ưu tiên chi tiết',
  },
};

const PHONE_PROFILE_GUIDANCE: Record<StreamProfile, typeof PROFILE_GUIDANCE[StreamProfile]> = {
  ...PROFILE_GUIDANCE,
  auto: {
    ...PROFILE_GUIDANCE.auto,
    resolution: 'Theo số pixel thật của màn hình, kể cả thiết bị nhỏ có panel độ phân giải cao.',
    fps: 'Theo Hz màn hình hỗ trợ (60/90/120/144), tự hạ khi mạng không đủ giữ nét.',
    bestFor: 'Lựa chọn tốt nhất cho đa số điện thoại, cả Wi-Fi lẫn 5G.',
  },
  competitive: {
    ...PROFILE_GUIDANCE.competitive,
    bitrateDetail: 'Cần Wi-Fi hoặc 5G ổn định khoảng 55 Mbps trở lên.',
    tradeoff: 'Tốn pin và nóng máy hơn do giải mã 120 khung mỗi giây.',
  },
  balanced: {
    ...PROFILE_GUIDANCE.balanced,
    tradeoff: 'Kém Quality một chút ở cảnh chuyển động nhanh, đổi lại ít giật khi Wi-Fi dao động.',
  },
  quality: {
    resolution: 'Preset dùng 1080p; Auto có thể tận dụng độ phân giải panel cao hơn.',
    fps: '60 FPS giữ nhịp đều, máy mát và ít tốn pin.',
    bitrate: '30 Mbps',
    bitrateDetail: 'Nên dùng Wi-Fi ổn định từ khoảng 40 Mbps.',
    bestFor: 'Game điện ảnh, xem chữ nhỏ và chi tiết xa.',
    tradeoff: 'Dùng bitrate cố định nên mạng yếu sẽ lộ ra thành vỡ hình.',
  },
  data_saver: {
    ...PROFILE_GUIDANCE.data_saver,
    bitrateDetail: 'Khoảng 3,6 GB mỗi giờ chơi; hoạt động tốt từ khoảng 12 Mbps.',
    tradeoff: 'Mềm hơn 1080p nhưng trên màn nhỏ khó nhận ra hơn nhiều so với laptop.',
  },
};

const PHONE_RESOLUTION_COPY: Partial<Record<Resolution, { device: string; guidance: string }>> = {
  auto: {
    device: 'Khớp số pixel thật của màn hình',
    guidance: 'Auto dựa trên panel, không áp trần 1080p chỉ vì thiết bị nhỏ. Máy chủ cần hỗ trợ độ phân giải tương ứng.',
  },
  '720p': {
    device: '4G/5G yếu · tiết kiệm data',
    guidance: 'Máy bạn sẽ dùng ít dữ liệu nhất; trên màn nhỏ độ mềm khó thấy hơn trên laptop.',
  },
  '900p': {
    device: 'Cân bằng độ nét và pin',
    guidance: 'Máy bạn sẽ giải mã nhẹ hơn 1080p khoảng 30%, máy mát hơn khi chơi lâu.',
  },
  '1080p': {
    device: 'Nét nhất trên màn điện thoại',
    guidance: 'Máy bạn sẽ nhận hình Full HD — mức nét cao nhất mà màn điện thoại thể hiện được.',
  },
};

const PHONE_FPS_COPY: Partial<Record<FrameRateChoice, string>> = {
  auto: 'Bám màn 60/90/120 Hz',
  '120': 'Mượt nhất, cần màn 120 Hz',
};

export type StreamSettingsCopy = {
  profileVisual: typeof PROFILE_VISUAL;
  profileGuidance: typeof PROFILE_GUIDANCE;
  resolutionOptions: SelectOption<StreamSettings['resolution']>[];
  resolutionGuidance: typeof RESOLUTION_GUIDANCE;
  fpsOptions: SelectOption<FrameRateChoice>[];
  regionGuidance: typeof REGION_GUIDANCE;
};

const LARGE_COPY: StreamSettingsCopy = {
  profileVisual: PROFILE_VISUAL,
  profileGuidance: PROFILE_GUIDANCE,
  resolutionOptions: RESOLUTION_OPTIONS,
  resolutionGuidance: RESOLUTION_GUIDANCE,
  fpsOptions: FPS_OPTIONS,
  regionGuidance: REGION_GUIDANCE,
};

const PHONE_COPY: StreamSettingsCopy = {
  profileVisual: PHONE_PROFILE_VISUAL,
  profileGuidance: PHONE_PROFILE_GUIDANCE,
  resolutionOptions: RESOLUTION_OPTIONS
    .filter((option) => option.value === 'auto' || tierWithinDeviceLimit(option.value, 'phone'))
    .map((option) => {
      const copy = PHONE_RESOLUTION_COPY[option.value];
      return copy ? { ...option, description: copy.device } : option;
    }),
  resolutionGuidance: Object.fromEntries(
    RESOLUTION_ORDER.map((value) => [value, PHONE_RESOLUTION_COPY[value]?.guidance ?? RESOLUTION_GUIDANCE[value]]),
  ) as typeof RESOLUTION_GUIDANCE,
  fpsOptions: FPS_OPTIONS
    .filter((option) => option.value === 'auto' || Number(option.value) <= DEVICE_MAX_FRAME_RATE.phone)
    .map((option) => {
      const description = PHONE_FPS_COPY[option.value];
      return description ? { ...option, description } : option;
    }),
  regionGuidance: {
    ...REGION_GUIDANCE,
    vn: 'Auto có thể chọn tới 4K/144 FPS theo panel và băng thông, kể cả trên thiết bị nhỏ.',
  },
};

/** Chữ và danh sách lựa chọn đúng cho loại màn đang chỉnh. */
export function streamSettingsCopy(deviceClass: StreamDeviceClass): StreamSettingsCopy {
  return deviceClass === 'phone' ? PHONE_COPY : LARGE_COPY;
}

export function frameRateChoice(settings: Pick<StreamSettings, 'frame_rate'>): FrameRateChoice {
  return settings.frame_rate ? String(settings.frame_rate) as FrameRateChoice : 'auto';
}
