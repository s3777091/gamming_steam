import type { SupabaseClient } from '@supabase/supabase-js';

import { autoFrameRate } from './display-refresh';
import { DEVICE_STREAM_DEFAULTS, panelResolution } from './stream-display-policy';
import { frameRateForDisplay } from './stream-display';
import {
  DEFAULT_LOADING_THEME_ID,
  isLoadingThemeId,
  type LoadingThemeId,
} from './loading-themes';
import {
  clientDisplayGeometry,
  hostRefreshCeiling,
  streamGeometryForTier,
  type DisplayGeometry,
  type HostDisplay,
} from './stream-geometry';

export {
  aspectsMatch,
  clientAspectRatio,
  clientDisplayGeometry,
  displayGeometriesMatch,
  displayGeometryForCssPixels,
  streamWillFillViewer,
} from './stream-geometry';
export type { DisplayGeometry, HostDisplay, HostDisplayMode } from './stream-geometry';

export type StreamProfile =
  | 'auto' | 'competitive' | 'balanced' | 'quality' | 'data_saver' | 'long_haul';
/**
 * Một bậc là MỘT BỀ NGANG mục tiêu, không phải một khung 16:9 cứng — chiều cao
 * luôn tới từ tỉ lệ màn hình người xem (xem `streamGeometryFor`).
 *
 * Dải nhắm vào TABLET → LAPTOP → MÀN HÌNH DESKTOP. Không có bậc nào dưới 720p
 * — chính bậc 960 px từng kéo màn hình ở nhà xuống 1176x664. Auto dùng cùng
 * thang theo pixel thật, kể cả trên điện thoại và tablet nhỏ.
 *
 * Sáu bậc thay vì bốn để lấp hai khoảng trống thật giữa chúng: tablet và laptop
 * 13–14" quanh 1600, laptop 3K / ultrawide quanh 3200. Với bốn bậc cũ, mọi màn
 * từ 1600 tới 2299 px đều bị dồn vào 1080p: màn 1600 bị xin dư 320 px rồi thu
 * lại, màn 2299 bị xin thiếu.
 *
 * 720p ở lại làm đáy, nhưng giờ là đáy về BITRATE cho đường truyền yếu, không
 * còn là một desktop 1280x720 (xem sàn trong `streamGeometryFor`).
 */
export type Resolution =
  | 'auto' | '720p' | '900p' | '1080p' | '1440p' | '1800p' | '4k';
export type VideoCodec = 'auto' | 'av1' | 'hevc' | 'h264';
export type LatencyMode = 'smooth' | 'balanced' | 'ultra_low';
/** The home-PC and VM streams use direct WebRTC only. */
export type IceMode = 'direct';
/**
 * Người xem đang ngồi ở đâu — thứ duy nhất trong cả file này mà không phép đo
 * nào suy ra được.
 *
 * Không phải để trang trí: `cn` nghĩa là mọi gói phải đi qua một đường quốc tế,
 * và điều đó thay đổi hai quyết định của đường AUTO (trần độ phân giải và trần
 * fps) NGAY TỪ KHUNG HÌNH ĐẦU TIÊN — trước khi có bất kỳ phép đo nào để hạ
 * theo. Xem `REGION_AUTO_CEILING`.
 *
 * Giá trị này do MÁY nhận ra từ địa chỉ IP của người xem (`/api/region`, bảng
 * phân bổ APNIC), không còn do người dùng tự khai. Cái nút hai lá cờ cũ hỏi sai
 * người vào sai lúc: trần tồn tại để cứu phiên ĐẦU TIÊN, mà phiên đầu tiên đúng
 * là lúc chưa ai mở trang cài đặt — nên thứ nó đọc được luôn là giá trị người
 * trước để lại.
 */
export type ViewerRegion = 'vn' | 'cn';

/**
 * Loại màn hình đang xem — quyết định cài đặt nằm ở BẢNG nào.
 *
 * Điện thoại có hàng riêng (`user_phone_stream_settings`) và mặc định riêng
 * (`phone_stream_settings_defaults`): một hàng chung cho mọi máy nghĩa là chọn
 * 4K cho màn desktop xong thì điện thoại cũng xin 4K, còn chỉnh trên điện thoại
 * thì ghi đè luôn cấu hình của laptop. `large` là mọi thứ còn lại — tablet,
 * laptop, desktop — và dùng đúng hai bảng cũ. Xem `detectStreamDeviceClass`.
 */
export type StreamDeviceClass = 'phone' | 'large';

export const STREAM_SETTINGS_TABLE: Record<StreamDeviceClass, string> = {
  large: 'user_stream_settings',
  phone: 'user_phone_stream_settings',
};

const STREAM_DEFAULTS_TABLE: Record<StreamDeviceClass, string> = {
  large: 'stream_settings_defaults',
  phone: 'phone_stream_settings_defaults',
};

export type StreamSettings = {
  user_id: string;
  profile: StreamProfile;
  resolution: Resolution;
  frame_rate: 30 | 60 | 90 | 120 | 144 | null;
  codec: VideoCodec;
  bitrate_mode: 'adaptive' | 'fixed';
  bitrate_mbps: number | null;
  encoder_mode: 'low_latency' | 'balanced' | 'high_quality';
  hdr: 'auto' | 'on' | 'off';
  ten_bit: 'auto' | 'on' | 'off';
  dynamic_resolution: boolean;
  frame_pacing: boolean;
  client_vsync: 'auto' | 'on' | 'off';
  latency_mode: LatencyMode;
  ice_mode: IceMode;
  region: ViewerRegion;
  hud_enabled: boolean;
  loading_theme: LoadingThemeId;
};

export const DEFAULT_STREAM_SETTINGS: Omit<StreamSettings, 'user_id'> = {
  profile: 'auto',
  resolution: 'auto',
  frame_rate: null,
  codec: 'auto',
  bitrate_mode: 'adaptive',
  bitrate_mbps: null,
  encoder_mode: 'balanced',
  hdr: 'off',
  ten_bit: 'off',
  dynamic_resolution: true,
  frame_pacing: true,
  client_vsync: 'auto',
  latency_mode: 'balanced',
  ice_mode: 'direct',
  region: 'vn',
  hud_enabled: false,
  loading_theme: DEFAULT_LOADING_THEME_ID,
};

export function isIceMode(value: unknown): value is IceMode {
  return value === 'direct';
}

export const ICE_MODE_META: Record<IceMode, { label: string; description: string }> = {
  direct: {
    label: 'Direct',
    description: 'Trình duyệt nói thẳng với máy ở nhà · độ trễ thấp nhất',
  },

};

export const REGION_META: Record<ViewerRegion, { label: string; flag: string; detail: string }> = {
  vn: { label: 'Việt Nam', flag: '🇻🇳', detail: 'Cùng nước với máy ở nhà · đường trong nước' },
  cn: { label: 'Trung Quốc', flag: '🇨🇳', detail: 'Qua đường quốc tế · giới hạn trần auto' },
};

/**
 * Trần mà đường AUTO được phép tự chọn tới, theo khu vực người xem.
 *
 * Chỉ chặn phần MÁY tự quyết. Người dùng tự tay chọn 4K hay 120 fps là quyết
 * định của họ và đi qua nguyên vẹn — cùng nguyên tắc `affordableFrameRate` đã
 * viết: không được âm thầm đổi thứ người ta chọn.
 *
 * Vì sao cần trần riêng khi đã có `usableBandwidth`: hàm ấy chỉ chạy khi ĐÃ có
 * một phép đo. Phiên đầu tiên của một client Trung Quốc chưa có hàng nào trong
 * `network_test_results`, nên auto sẽ nhìn vào panel 2560 px của họ, chọn
 * 1440p, và cả phiên đầu trôi qua ở một độ phân giải mà đường ấy không nuôi
 * nổi. Khu vực là thứ biết trước điều đó.
 */
const REGION_AUTO_CEILING: Record<ViewerRegion, { resolution: Exclude<Resolution, 'auto'>; fps: number }> = {
  vn: { resolution: '4k', fps: 144 },
  cn: { resolution: '1080p', fps: 60 },
};

/**
 * Nổ ngay thay vì lặng lẽ coi khu vực lạ là 'vn'.
 *
 * Cột `region` có CHECK constraint nên giá trị lạ chỉ đến từ một lỗi thật —
 * migration chưa chạy, hoặc một chỗ nào đó ghi thẳng vào bảng. Rơi về mặc định
 * ở đây sẽ biến lỗi ấy thành "sao stream vẫn 1440p" ba tuần sau.
 */
function regionCeiling(region: ViewerRegion) {
  const ceiling = REGION_AUTO_CEILING[region];
  if (!ceiling) {
    throw new Error(
      `Khu vực người xem không hợp lệ: ${JSON.stringify(region)}. `
      + `Chỉ nhận ${Object.keys(REGION_AUTO_CEILING).join(' hoặc ')}.`,
    );
  }
  return ceiling;
}

/** Bậc cao nhất người dùng tự chọn được trên từng loại màn — khớp CHECK của bảng. */
export const DEVICE_RESOLUTION_LIMIT: Record<StreamDeviceClass, Exclude<Resolution, 'auto'>> = {
  large: '4k',
  phone: '1080p',
};

/** fps cao nhất người dùng tự chọn được — khớp CHECK của bảng. */
export const DEVICE_MAX_FRAME_RATE: Record<StreamDeviceClass, number> = {
  large: 144,
  phone: 120,
};

export function tierWithinDeviceLimit(
  tier: Exclude<Resolution, 'auto'>,
  deviceClass: StreamDeviceClass,
): boolean {
  return atMostTier(tier, DEVICE_RESOLUTION_LIMIT[deviceClass]);
}

export const PROFILE_SETTINGS: Record<StreamProfile, Partial<StreamSettings>> = {
  auto: {
    resolution: 'auto', frame_rate: null, codec: 'auto', bitrate_mode: 'adaptive',
    bitrate_mbps: null, latency_mode: 'balanced', encoder_mode: 'balanced', dynamic_resolution: true,
    hdr: 'off', ten_bit: 'off', frame_pacing: true, client_vsync: 'auto',
  },
  competitive: {
    resolution: '1080p', frame_rate: 120, codec: 'auto', bitrate_mode: 'fixed',
    bitrate_mbps: 45, latency_mode: 'ultra_low', encoder_mode: 'low_latency', dynamic_resolution: true,
  },
  balanced: {
    // Balanced describes resolution/latency, not a decoder requirement. Keep
    // codec selection automatic so this preset cannot silently force HEVC on a
    // browser that has no usable HEVC pipeline.
    resolution: '1080p', frame_rate: 60, codec: 'auto', bitrate_mode: 'adaptive',
    bitrate_mbps: 25, latency_mode: 'balanced', encoder_mode: 'balanced', dynamic_resolution: true,
    hdr: 'off', ten_bit: 'off', frame_pacing: true, client_vsync: 'auto',
  },
  quality: {
    resolution: '4k', frame_rate: 60, codec: 'auto', bitrate_mode: 'fixed',
    bitrate_mbps: 70, latency_mode: 'balanced', encoder_mode: 'high_quality', dynamic_resolution: false,
  },
  data_saver: {
    resolution: '720p', frame_rate: 60, codec: 'h264', bitrate_mode: 'fixed',
    bitrate_mbps: 8, latency_mode: 'smooth', encoder_mode: 'balanced', dynamic_resolution: true,
  },
  // Đường xa (điển hình: người xem ở Trung Quốc đại lục). Mọi thông số để AUTO
  // — không ghim độ phân giải, fps hay bitrate — vì con số đúng cho đường này
  // phụ thuộc vào đường, không phải vào một bảng viết sẵn: cùng một client TQ
  // có thể mượt ở 20 Mbps lúc 3 giờ chiều và phải xuống 8 Mbps lúc 9 giờ tối.
  // `usableBandwidth` mới là chỗ làm việc đó; preset này chỉ nói "hãy để nó
  // làm" cộng hai thứ mà auto không tự suy ra được:
  //
  //   latency_mode 'smooth' — bộ đệm nhận 80 ms. Đây mới là điểm khác biệt
  //     thật. Jitter xuyên quốc gia thường 30–80 ms, mà `balanced` chỉ đệm
  //     30 ms, nên phần lớn dao động tràn qua bộ đệm và hiện ra thành giật li
  //     ti dù không rớt khung nào.
  //   dynamic_resolution — cho phép hạ ngân sách bit xuống bậc 720p khi băng
  //     thông tụt, nhưng vẫn giữ nguyên geometry desktop đã khớp với màn hình.
  long_haul: {
    resolution: 'auto', frame_rate: null, codec: 'auto', bitrate_mode: 'adaptive',
    bitrate_mbps: null, latency_mode: 'smooth', encoder_mode: 'balanced', dynamic_resolution: true,
    hdr: 'off', ten_bit: 'off', frame_pacing: true, client_vsync: 'auto',
  },
};

/**
 * Preset cho điện thoại: giống hệt bảng trên, trừ những bậc màn nhỏ không dùng.
 *
 * Không hạ bitrate cho điện thoại. Lý lẽ "màn nhỏ giấu lỗi nén nên cần ít bit
 * hơn" chỉ đúng nửa vời: mọi luồng đều bị ép về H.264
 * (`applyStreamTargetTransportPolicy`), codec cần nhiều bit nhất trong ba, và
 * khung gửi đi vẫn là 1920x1080 của máy ở nhà — cùng số điểm ảnh, cùng nhu cầu
 * bit như trên laptop. Bớt bit ở đây là mềm hình thật, không phải tiết kiệm.
 */
const PHONE_PROFILE_SETTINGS: Record<StreamProfile, Partial<StreamSettings>> = {
  ...PROFILE_SETTINGS,
  // 4K không có nghĩa trên màn 6–7" (và bảng điện thoại không nhận nó), nên
  // Quality là 1080p60 với nhiều bit nhất mà bậc ấy dùng được.
  quality: {
    resolution: '1080p', frame_rate: 60, codec: 'auto', bitrate_mode: 'fixed',
    bitrate_mbps: 30, latency_mode: 'balanced', encoder_mode: 'high_quality', dynamic_resolution: false,
  },
};

export function profileSettingsFor(
  profile: StreamProfile,
  deviceClass: StreamDeviceClass,
): Partial<StreamSettings> {
  return (deviceClass === 'phone' ? PHONE_PROFILE_SETTINGS : PROFILE_SETTINGS)[profile];
}

export const PROFILE_META: Record<StreamProfile, { label: string; detail: string }> = {
  auto: { label: 'Auto', detail: 'Tự chọn theo màn hình và mạng' },
  competitive: { label: 'Competitive', detail: '1080p · 120 FPS · độ trễ thấp' },
  balanced: { label: 'Balanced', detail: '1080p · 60 FPS · mượt ổn định' },
  quality: { label: 'Quality', detail: '4K · 60 FPS · hình ảnh cao' },
  data_saver: { label: 'Data Saver', detail: '720p · 60 FPS · tiết kiệm dữ liệu' },
  long_haul: { label: 'Đường xa', detail: 'Tự động · chống jitter đường quốc tế' },
};

export type MoonlightSettings = {
  bitrate: number;
  fps: number;
  videoFrameQueueSize: number;
  videoSize: '720p' | '1080p' | '1440p' | '4k' | 'custom';
  videoSizeCustom: { width: number; height: number };
  videoCodec: 'auto' | 'av1' | 'h265' | 'h264';
  hdr: boolean;
  canvasVsync: boolean;
};

// A tier names a horizontal quality target, not a literal frame: the height
// comes from the client's own aspect ratio. Asking for a fixed 16:9 frame is
// what used to put black bars above and below the picture on every 16:10 laptop
// and ultrawide. StreamTakeover now stretches only the final rendered surface
// when the host cannot adopt that shape; matching the host first still avoids
// both distortion and needless resampling whenever Windows has the right mode.
const RESOLUTION_SIZE: Record<Exclude<Resolution, 'auto'>, [number, number]> = {
  '720p': [1280, 720],
  '900p': [1600, 900],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
  '1800p': [3200, 1800],
  '4k': [3840, 2160],
};

/** Các bậc theo đúng thứ tự từ nhẹ nhất tới nặng nhất. */
export const RESOLUTION_LADDER: Exclude<Resolution, 'auto'>[] = [
  '720p', '900p', '1080p', '1440p', '1800p', '4k',
];

/** Thứ tự bày ra cho người dùng: auto trước, rồi nặng dần. */
export const RESOLUTION_ORDER: Resolution[] = ['auto', ...RESOLUTION_LADDER];

/**
 * Một chỗ duy nhất mô tả các bậc cho người dùng — dùng chung giữa thanh điều
 * khiển trên cùng lúc đang stream và trang cài đặt, để hai nơi không bao giờ
 * nói hai điều khác nhau về cùng một bậc.
 *
 * `device` là loại màn hình mà bậc ấy vừa khít, vì đó mới là câu hỏi người dùng
 * thật sự đang hỏi khi mở danh sách này ("tôi đang dùng tablet thì chọn cái
 * nào"), chứ không phải con số pixel.
 */
export const RESOLUTION_META: Record<Resolution, {
  label: string;
  width: string;
  device: string;
  guidance: string;
}> = {
  auto: {
    label: 'Tự động',
    width: 'Theo màn hình',
    device: 'Khớp màn hình đang xem và chất lượng mạng',
    guidance: 'Auto dùng ngân sách đủ cho số pixel thật của màn hình; khi mạng yếu giảm bitrate nén, không thu nhỏ desktop.',
  },
  '720p': {
    label: '720p',
    width: 'ngang 1280',
    device: 'Tablet hoặc laptop qua mạng yếu · 4G',
    guidance: 'Máy bạn sẽ dùng ít dữ liệu nhất; khung hình vẫn theo màn hình máy ở nhà, chỉ ít bit hơn nên chữ nhỏ và texture mềm đi.',
  },
  '900p': {
    label: '900p',
    width: 'ngang 1600',
    device: 'Tablet, laptop 13–14"',
    guidance: 'Máy bạn sẽ khớp gần đúng số pixel của laptop nhỏ, không phải phóng to từ 720p hay thu nhỏ từ 1080p.',
  },
  '1080p': {
    label: '1080p',
    width: 'ngang 1920',
    device: 'Tablet lớn, laptop, màn desktop phổ thông',
    guidance: 'Máy bạn sẽ giữ hình Full HD rõ nét với mức tải mạng vừa phải.',
  },
  '1440p': {
    label: '1440p',
    width: 'ngang 2560',
    device: 'Laptop Retina, màn desktop 2K',
    guidance: 'Máy bạn sẽ hiển thị chi tiết cao hơn 1080p nhưng cần khoảng 30–45 Mbps.',
  },
  '1800p': {
    label: '1800p',
    width: 'ngang 3200',
    device: 'Laptop 3K, màn desktop ultrawide',
    guidance: 'Máy bạn sẽ phủ kín những panel rộng hơn 2560 mà chưa tới 4K, cần khoảng 40–60 Mbps.',
  },
  '4k': {
    label: '4K',
    width: 'ngang 3840',
    device: 'Màn hình desktop 4K',
    guidance: 'Máy bạn sẽ ưu tiên độ nét 4K; nên có màn hình 4K và ít nhất 55–85 Mbps.',
  },
};

/** `a` nhẹ hơn hay bằng `b`. */
function atMostTier(a: Exclude<Resolution, 'auto'>, b: Exclude<Resolution, 'auto'>): boolean {
  return RESOLUTION_LADDER.indexOf(a) <= RESOLUTION_LADDER.indexOf(b);
}

function capTier(
  tier: Exclude<Resolution, 'auto'>,
  ceiling: Exclude<Resolution, 'auto'>,
): Exclude<Resolution, 'auto'> {
  return atMostTier(tier, ceiling) ? tier : ceiling;
}

/**
 * Bậc khớp với số pixel thật của màn hình đang xem.
 *
 * Chọn ngân sách đủ chứa pixel thật; geometry giới hạn ở độ rộng panel.
 * Màn 2732 px cần ngân sách 1800p, tránh bị thu xuống 2560 rồi phóng lên lại.
 */
function autoResolution(display: DisplayGeometry): Exclude<Resolution, 'auto'> {
  return panelResolution(display.width);
}

/**
 * The frame to ask Sunshine for, and the one decision that governs black bars.
 *
 * Sunshine never distorts. Asked for a frame whose aspect differs from its
 * desktop, it keeps the desktop's proportions and pads the rest with black —
 * inside the encoded picture. Those bars are pixels by the time they reach the
 * browser: nothing on this side can remove them, and the image is scaled twice
 * on the way. So the frame's shape must be a shape the host desktop can
 * actually be, and there are only two of those:
 *
 *   • The host can switch to the viewer's shape (Sunshine's display-device
 *     configuration is on and Windows has the mode) — ask for the viewer's
 *     shape. Sunshine changes the desktop, the picture fills the screen edge to
 *     edge, and nothing is cropped or stretched.
 *   • It cannot — ask for the host's own shape. Sunshine does no scaling and
 *     cannot bake bars into the encoded frame. StreamTakeover then stretches
 *     that clean frame to the viewer surface and overrides Moonlight's input
 *     rectangle with the same bounds, so all pixels and clicks stay aligned.
 *
 * Cropping is still deliberately not an option: it hides desktop controls.
 * Stretching preserves every desktop pixel, and the paired getStreamRect patch
 * prevents Moonlight's normal contain correction from offsetting input.
 *
 * Without the agent the host is unknown, and the viewer's screen is the best
 * remaining guess.
 *
 * A host mode is returned VERBATIM, never snapped. The number sent from here is
 * the literal size Sunshine hands to Windows ("Changing display modes to:" in
 * sunshine.log), and Windows takes a mode or refuses — being two pixels off one
 * is not a near miss, it is a failed switch, after which the desktop stays as it
 * was and Sunshine pads the picture to the shape that was asked for. That is
 * exactly how the bars came back: this monitor's only 16:10 mode is 1680x1050,
 * the one height among its twenty modes that is not a multiple of four, and
 * snapToBlock turned it into a 1680x1052 that does not exist.
 *
 * ---------------------------------------------------------------------------
 * SÀN: CHÍNH SÁCH PHẦN CỨNG, KHÔNG PHẢI MODE ĐANG CHẠY
 *
 * `dd_resolution_option = auto` biến con số trả về từ đây thành ĐỘ PHÂN GIẢI
 * MÀN HÌNH VẬT LÝ ở nhà, chứ không phải một tuỳ chọn mã hoá. Không có sàn thì
 * người xem trên màn nhỏ kéo tụt màn hình của người đang ngồi tại máy: ngày
 * 2026-08-03 màn 1920x1080 bị đưa xuống 1280x720, rồi 1176x664 — bậc 540p có
 * trần ngang 960, mà màn này không có chế độ 16:9 nào ≤ 960 nên nhánh "không
 * mode nào lọt" trả về mode NHỎ NHẤT.
 *
 * Vì `/display` chỉ trả mode hiện tại — có thể chính là mode tạm của phiên cũ —
 * sàn tuyệt đối không được suy ra từ `host.width`. PC dùng sàn phần cứng
 * 1920 đã biết; VM không có màn vật lý nên sàn bằng 0 (xem
 * `stream-host-policy`). Bậc thấp vẫn còn tác dụng qua BITRATE, không còn qua
 * việc thu nhỏ desktop của người đang ngồi tại PC.
 *
 * Điều này KHÔNG chống được mọi thay đổi chế độ màn hình: người xem 16:10 vẫn
 * kéo desktop sang 1680x1050, vì đó là chế độ 16:10 lớn nhất máy này có và
 * không đổi sang tỉ lệ ấy nghĩa là viền đen nướng thẳng vào ảnh. Đổi tỉ lệ để
 * khỏi viền là chủ ý; tụt xuống 664 dòng quét thì không.
 *
 * Màn hình nhỏ không phải mất mát: Moonlight bản điện thoại tự lo phần đó, và
 * nó không đi qua đường này.
 */
export function streamGeometryFor(
  resolution: Exclude<Resolution, 'auto'>,
  display: DisplayGeometry = clientDisplayGeometry(),
  host?: HostDisplay | null,
): DisplayGeometry {
  return streamGeometryForTier(RESOLUTION_SIZE[resolution][0], display, host);
}

const DEFAULT_BITRATE: Record<Exclude<Resolution, 'auto'>, number> = {
  '720p': 8,
  '900p': 15,
  '1080p': 25,
  '1440p': 38,
  '1800p': 50,
  '4k': 65,
};

// Oversized fixed bitrates create queueing and input jitter without improving
// the decoded image meaningfully. Keep a resolution-aware safety ceiling even
// when a stale cloud setting (for example 70 Mbps from the 4K profile) is later
// rendered at a smaller auto-selected resolution.
const SMOOTH_BITRATE_CEILING: Record<Exclude<Resolution, 'auto'>, number> = {
  '720p': 12,
  '900p': 22,
  '1080p': 35,
  '1440p': 50,
  '1800p': 64,
  '4k': 80,
};

/**
 * Băng thông dùng được tối thiểu để một bậc còn giữ được nét ở 60 fps.
 *
 * Đây là bảng mà `dynamic_resolution` tra. Nó KHÔNG bằng `DEFAULT_BITRATE`:
 * bảng kia là mức muốn dùng, bảng này là mức dưới đó thì ảnh bắt đầu vỡ khối
 * và hạ một bậc cho ảnh đẹp hơn là cố giữ bậc cao bằng một bitrate quá mỏng.
 * 720p không có ngưỡng — nó là đáy, dưới nữa thì vấn đề không còn là độ phân
 * giải (cùng lý lẽ với `LONG_HAUL_MIN_SCALE`).
 */
const TIER_MIN_MBPS: Record<Exclude<Resolution, 'auto'>, number> = {
  '720p': 0,
  '900p': 11,
  '1080p': 18,
  '1440p': 30,
  '1800p': 40,
  '4k': 55,
};

/**
 * Bậc cao nhất không vượt `target` mà `measured` Mbps còn nuôi nổi.
 *
 * Chỉ đi xuống, không bao giờ đi lên: một đường đo được 80 Mbps không phải là
 * lý do để đẩy màn hình 1080p lên 4K.
 */
function affordableResolution(
  target: Exclude<Resolution, 'auto'>,
  measured: number,
): Exclude<Resolution, 'auto'> {
  for (let index = RESOLUTION_LADDER.indexOf(target); index > 0; index -= 1) {
    const tier = RESOLUTION_LADDER[index];
    if (measured >= TIER_MIN_MBPS[tier]) return tier;
  }
  return RESOLUTION_LADDER[0];
}

/**
 * Bao nhiêu ms hình được giữ lại ở phía nhận trước khi trình ra màn.
 *
 * Đây là knob quyết định "mượt" mà moonlight-web ghim cứng ở 0 (xem
 * `receiver.jitterBufferTarget = 0` trong web/stream/transport/webrtc.ts). Ở 0,
 * Chrome trình mỗi khung hình ngay khi ghép xong gói cuối của nó, nên mọi dao
 * động thời gian đến trên đường truyền hiện nguyên hình thành nhịp trình không
 * đều — thứ mắt đọc ra là "giật li ti" dù không rớt khung nào. Một khoảng đệm
 * nhỏ cho Chrome đủ chỗ để san phẳng nhịp ấy, và giá phải trả đúng bằng con số
 * ms ghi ở đây.
 *
 * `ultra_low` giữ 0 để chế độ này vẫn đúng nghĩa là cực trị độ trễ như cũ.
 */
export const JITTER_BUFFER_TARGET_MS: Record<LatencyMode, number> = {
  smooth: 80,
  balanced: 30,
  ultra_low: 0,
};

/**
 * Bảng bitrate ở trên viết cho 60 fps.
 *
 * Gấp đôi số khung hình không cần gấp đôi bitrate — hai khung liền nhau ở 120
 * fps giống nhau hơn ở 60 fps nên phần chênh lệch phải mã hoá mỗi khung nhỏ đi
 * — nhưng vẫn PHẢI thêm. Giữ nguyên bitrate mà tăng fps là chia cùng số bit
 * cho gấp đôi số khung: luồng mượt hơn và mềm hơn cùng lúc, đúng cái đánh đổi
 * không ai muốn. Hệ số +50% cho mỗi lần gấp đôi fps là mức Moonlight trên máy
 * tính vẫn dùng (1080p60 ~20 Mbps → 1080p120 ~30 Mbps).
 */
function fpsBitrateScale(fps: number): number {
  return Math.min(1.8, Math.max(0.75, 1 + (fps / 60 - 1) * 0.5));
}

/**
 * fps cao nhất mà đường truyền còn đủ bit để giữ ảnh nét ở độ phân giải này.
 *
 * Chỉ chi phối đường "auto". Người dùng tự chọn 120 fps là quyết định của họ và
 * được tôn trọng nguyên vẹn; còn khi máy tự chọn thì không được phép âm thầm
 * đổi độ nét lấy độ mượt. Không có phép đo băng thông thật thì không suy diễn
 * gì — cùng lý do adaptive bitrate không tin `navigator.connection.downlink`.
 */
function affordableFrameRate(
  target: number,
  resolution: Exclude<Resolution, 'auto'>,
  pixelScale: number,
  measuredMbps?: number,
): number {
  if (typeof measuredMbps !== 'number') return target;
  const usable = measuredMbps * 0.8;
  // `target` có thể nằm lệch bậc (100 fps theo màn 100 Hz của máy chủ): thử
  // chính nó trước, rồi mới tới các bậc thấp hơn.
  const tiers = [target, ...[144, 120, 90, 60].filter((tier) => tier < target)];
  for (const tier of tiers) {
    if (usable >= DEFAULT_BITRATE[resolution] * pixelScale * fpsBitrateScale(tier)) return tier;
  }
  return tiers[tiers.length - 1] ?? target;
}

/**
 * Lần đo mạng gần nhất của người dùng — nguyên một hàng `network_test_results`,
 * không chỉ mỗi băng thông.
 *
 * Băng thông một mình không mô tả nổi một đường truyền xa. Một client ở Trung
 * Quốc đo ra 40 Mbps vẫn giật liên tục nếu RTT 150 ms và có mất gói: WebRTC vá
 * gói mất bằng NACK/RTX, mà mỗi lần vá tốn đúng MỘT RTT — ở 150 ms thì gói vá
 * về sau khi khung hình lẽ ra đã phải trình ra rồi, tức là vá cũng như không.
 * Đường càng xa thì cách duy nhất còn lại để giữ hình liền mạch là GỬI ÍT GÓI
 * HƠN, không phải gửi nhiều hơn cho chắc.
 */
export type NetworkMeasurement = {
  bandwidthMbps?: number | null;
  rttMs?: number | null;
  lossPercent?: number | null;
};

// Dưới sàn RTT là mạng trong nước: hệ số phải bằng đúng 1.0 để không một phiên
// nào đang chạy tốt bị đổi vì thay đổi này. Trần 200 ms là mức RTT thường thấy
// của China Mobile / China Telecom 163 về FPT dân dụng lúc cao điểm.
const LONG_HAUL_RTT_FLOOR_MS = 60;
const LONG_HAUL_RTT_CEIL_MS = 200;
const LONG_HAUL_RTT_MIN_SCALE = 0.6;

// `packet_loss_percent` của bài test là số fetch hỏng trên 6 lần, nên bước nhảy
// nhỏ nhất đã là 16.7%. Đây là tín hiệu THÔ — "đường này có vấn đề" — chứ không
// phải packet loss thật của luồng video, nên đừng derate theo nó như thể con số
// chính xác: một lần hỏng không được phép cắt đôi bitrate.
const LOSS_FULL_DERATE_PERCENT = 25;
const LOSS_MIN_SCALE = 0.55;

// Sàn chung. Dưới mức này thì vấn đề không còn là bitrate nữa — đường truyền
// hỏng thật, và hạ tiếp chỉ làm ảnh nhòe mà vẫn giật.
const LONG_HAUL_MIN_SCALE = 0.4;

/** 1.0 tại `floor` rồi giảm tuyến tính về `minScale` tại `ceil`. */
function derate(value: number, floor: number, ceil: number, minScale: number): number {
  if (!(value > floor)) return 1;
  return 1 - Math.min(1, (value - floor) / (ceil - floor)) * (1 - minScale);
}

/**
 * Phần băng thông đo được mà đường truyền này thật sự nuôi nổi một luồng video
 * liền mạch — `undefined` khi chưa có phép đo nào.
 *
 * Hạ ở ĐÂY, một chỗ duy nhất, thay vì rải điều kiện "nếu là đường xa" khắp nơi:
  * mọi quyết định phía sau (`dynamic_resolution` hạ quality tier, `affordableFrameRate`
 * chọn fps, adaptive bitrate) đều đã đọc con số này rồi, nên tất cả tự biết về
 * đường xa mà không hàm nào phải sửa.
 *
 * Áp cho MỌI profile, không riêng `long_haul`. Một đường trong nước sạch có RTT
 * dưới sàn và loss 0 nên hệ số ra đúng 1.0 — không đổi gì; chỉ đường thật sự
 * xấu mới bị hạ, và khi đó hạ là điều đúng bất kể người dùng chọn preset nào.
 */
function usableBandwidth(measurement?: NetworkMeasurement | null): number | undefined {
  const bandwidth = measurement?.bandwidthMbps;
  if (typeof bandwidth !== 'number' || !(bandwidth > 0)) return undefined;

  const rtt = typeof measurement?.rttMs === 'number' ? measurement.rttMs : 0;
  const loss = typeof measurement?.lossPercent === 'number' ? measurement.lossPercent : 0;
  const scale = Math.max(
    LONG_HAUL_MIN_SCALE,
    derate(rtt, LONG_HAUL_RTT_FLOOR_MS, LONG_HAUL_RTT_CEIL_MS, LONG_HAUL_RTT_MIN_SCALE)
      * derate(loss, 0, LOSS_FULL_DERATE_PERCENT, LOSS_MIN_SCALE),
  );
  return bandwidth * scale;
}

export function resolveMoonlightSettings(
  settings: StreamSettings,
  measurement?: NetworkMeasurement | null,
  hostDisplay?: HostDisplay | null,
  displayRefreshHz?: number | null,
  viewerDisplay?: DisplayGeometry | null,
  _deviceClass: StreamDeviceClass = 'large',
): MoonlightSettings {
  // StreamTakeover passes the measured iframe container here. The fallback is
  // for callers without a rendered surface (settings previews and SSR/tests).
  const display = viewerDisplay ?? clientDisplayGeometry();
  const region = regionCeiling(settings.region);
  const ceiling = region;
  // Trần khu vực chỉ chặn đường auto; bậc người dùng tự chọn đi qua nguyên vẹn.
  const geometryResolution: Exclude<Resolution, 'auto'> =
    settings.resolution === 'auto'
      ? capTier(autoResolution(display), ceiling.resolution)
      : settings.resolution;

  // A REAL measured bandwidth (from the network test) is the only trustworthy
  // adaptive signal. navigator.connection.downlink — what this used to key off —
  // is capped by Chrome to ~10 Mbps for privacy, so adaptive bitrate got
  // throttled to ~7 Mbps on every connection regardless of the real link: detail
  // lost while the stream stayed "smooth". With no measurement yet, don't
  // throttle at all — use the resolution's target bitrate.
  //
  // Con số đã trừ phần RTT và mất gói ăn mất (xem `usableBandwidth`), nên mọi
  // nhánh auto phía dưới đọc đúng thứ đường truyền nuôi nổi chứ không phải thứ
  // nó đo được trong một cú tải 512 KB.
  const measured = usableBandwidth(measurement);

  // Network quality may lower bits-per-pixel, but it must not resize the remote
  // Windows desktop. The old code reused the affordable tier as display
  // geometry, which turned a real 1936x1048 viewer into a 1280x720 Sunshine
  // request whenever a measurement dipped below 11 Mbps. That is a quality
  // decision leaking into desktop topology. Explicit resolution choices still
  // control geometry; only the automatic network downgrade is decoupled.
  const qualityResolution = settings.dynamic_resolution && typeof measured === 'number'
    ? affordableResolution(geometryResolution, measured)
    : geometryResolution;

  // Native Auto uses the panel's real pixels, including between-tier devices.
  // Explicit choices keep their requested width. VDD never inherits the local
  // physical monitor's floor or silently substitutes a differently shaped mode.
  const { width, height } = hostDisplay?.displayMode === 'virtual' && settings.resolution === 'auto'
    ? streamGeometryForTier(Math.min(RESOLUTION_SIZE[geometryResolution][0], display.width), display, hostDisplay, true)
    : streamGeometryFor(geometryResolution, display, hostDisplay);

  // The bitrate tables are written for each tier's nominal 16:9 frame. A 16:10
  // panel carries ~11% more pixels at the same tier, so carry the same
  // bits-per-pixel across rather than quietly shipping a softer image. An
  // explicit user-chosen Mbps is left exactly as the user set it.
  //
  // Trừ đúng một trường hợp: khung hình bị SÀN của host đẩy vượt bậc (xem
  // `streamGeometryFor`). Lúc đó khung to hơn không phải vì người dùng muốn
  // hình to hơn, mà vì không được phép thu nhỏ desktop nhà người ta — nên trả
  // đúng bitrate của bậc đã chọn, không cộng thêm cho đống pixel không ai xin.
  // Đây cũng là chỗ bậc thấp còn giữ được ý nghĩa sau khi có sàn: chọn 720p
  // giờ nghĩa là "cùng khung hình ấy nhưng ít bit hơn", tức mềm hơn chứ không
  // nhỏ hơn.
  const [nominalWidth, nominalHeight] = RESOLUTION_SIZE[qualityResolution];
  const pixelScale = width > RESOLUTION_SIZE[qualityResolution][0]
    ? 1
    : Math.min(1.4, Math.max(0.6, (width * height) / (nominalWidth * nominalHeight)));

  // fps phải chốt TRƯỚC bitrate, vì bitrate co giãn theo nó.
  //
  // `frame_rate` là null nghĩa là "auto", và auto cũ hoá ra là hằng số 60: mọi
  // phiên tới nay đều xin đúng 60 fps ("Requested frame rate [60/1 exactly 60
  // fps]" trong log Sunshine) kể cả khi đang xem trên panel 120 Hz. Auto giờ bám
  // tần số quét đo được của chính màn hình đó, rồi hạ lại nếu đường truyền không
  // đủ bit để nuôi số khung ấy mà vẫn giữ nét.
  //
  // Trần khu vực áp lên `autoFrameRate` chứ không áp lên `settings.frame_rate`:
  // 120 fps qua đường Trung Quốc là một lựa chọn tồi để MÁY tự đưa ra, nhưng
  // vẫn là lựa chọn của người dùng nếu họ tự bấm.
  //
  // Trần thứ ba là tần số quét của chính mode máy chủ sẽ chạy (xem
  // `hostRefreshCeiling`): tablet 120 Hz xem máy 100 Hz thì xin đúng 100 fps,
  // không xin 120 rồi nhận khung lặp. Con số lệch bậc như 100 là hợp lệ —
  // Moonlight/Sunshine nhận fps tuỳ ý. Cũng chỉ chặn auto: người dùng tự chọn
  // 120 fps thì vẫn đi qua nguyên vẹn.
  const hostRefresh = hostRefreshCeiling(hostDisplay, { width, height });
  const requestedFps = settings.frame_rate
    ?? affordableFrameRate(
      Math.min(autoFrameRate(displayRefreshHz ?? null), ceiling.fps, hostRefresh ?? Number.POSITIVE_INFINITY),
      qualityResolution,
      pixelScale,
      measured,
    );
  const fps = frameRateForDisplay(hostDisplay, { width, height }, requestedFps, settings.frame_rate != null);

  const fpsScale = fpsBitrateScale(fps);
  const requestedBitrate =
    settings.bitrate_mbps ?? Math.round(DEFAULT_BITRATE[qualityResolution] * pixelScale * fpsScale);
  const targetBitrate = Math.min(
    requestedBitrate,
    Math.round(SMOOTH_BITRATE_CEILING[qualityResolution] * pixelScale * fpsScale),
  );
  const adaptiveBitrate =
    settings.bitrate_mode === 'adaptive' && typeof measured === 'number'
      ? Math.max(6, Math.min(targetBitrate, Math.floor(measured * 0.8)))
      : targetBitrate;
  return {
    bitrate: adaptiveBitrate * 1000,
    fps,
    videoFrameQueueSize:
      settings.latency_mode === 'smooth' ? 3 : settings.latency_mode === 'ultra_low' ? 1 : 2,
    // Always "custom": moonlight-web only reads videoSizeCustom in that mode,
    // and its named tiers are hard-coded 16:9 frames.
    videoSize: 'custom',
    videoSizeCustom: { width, height },
    videoCodec: settings.codec === 'hevc' ? 'h265' : settings.codec,
    // Do not silently turn a normal stream into HEVC Main10 merely because the
    // receiving panel advertises HDR. Explicit "on" still preserves the quality
    // option; legacy "auto" rows now take the lower-latency SDR/8-bit path.
    hdr: settings.hdr === 'on',
    canvasVsync: settings.client_vsync === 'on' || (settings.client_vsync === 'auto' && settings.frame_pacing),
  };
}

export function completeSettings(
  userId: string,
  value?: Partial<StreamSettings> | null,
  defaults?: Partial<StreamSettings> | null,
): StreamSettings {
  // Precedence: hard-coded fallback < canonical Supabase defaults < the user's
  // own saved row. Passing `defaults` alone (no `value`) yields the canonical
  // config itself — used by the rollback control and its comparison.
  const settings = { user_id: userId, ...DEFAULT_STREAM_SETTINGS, ...defaults, ...value };
  return {
    ...settings,
    // Retired `auto` and `relay` values are normalized when old rows load.
    ice_mode: 'direct',
    loading_theme: isLoadingThemeId(settings.loading_theme)
      ? settings.loading_theme
      : DEFAULT_LOADING_THEME_ID,
  };
}

// The fields that make up the shared "best" config. hud_enabled is deliberately
// excluded — it is a per-device diagnostic toggle, so flipping the HUD must
// never look like the user drifted from the canonical settings.
//
// Region is detected per viewer. `ice_mode` stays out of shared defaults because
// the transport is fixed to Direct and legacy rows are normalized on load.
export const SHARED_STREAM_SETTING_KEYS: (keyof Omit<StreamSettings, 'user_id'>)[] = [
  'profile', 'resolution', 'frame_rate', 'codec', 'bitrate_mode', 'bitrate_mbps',
  'encoder_mode', 'hdr', 'ten_bit', 'dynamic_resolution', 'frame_pacing',
  'client_vsync', 'latency_mode', 'loading_theme',
];

/** Inherit cloud tuning, with automatic pixels/Hz/bitrate for this native device. */
export async function fetchStreamSettingsDefaults(
  supabase: SupabaseClient,
  deviceClass: StreamDeviceClass,
): Promise<Partial<StreamSettings> | null> {
  const { data, error } = await supabase
    .from(STREAM_DEFAULTS_TABLE[deviceClass])
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error || !data) return { ...DEVICE_STREAM_DEFAULTS };
  const row = data as Record<string, unknown>;
  const picked: Partial<StreamSettings> = {};
  for (const key of SHARED_STREAM_SETTING_KEYS) {
    // Nullable columns (frame_rate, bitrate_mbps) carry meaning when null
    // ("auto"), so copy the value through as-is.
    if (row[key] !== undefined) (picked as Record<string, unknown>)[key] = row[key];
  }
  return { ...picked, ...DEVICE_STREAM_DEFAULTS };
}

/** True when the user has changed any shared setting away from the canonical. */
export function streamSettingsDifferFromDefaults(
  settings: StreamSettings,
  defaults: Partial<StreamSettings> | null | undefined,
): boolean {
  const canonical = completeSettings(settings.user_id, defaults);
  return SHARED_STREAM_SETTING_KEYS.some((key) => settings[key] !== canonical[key]);
}
