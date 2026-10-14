/**
 * Tinh chỉnh SDP Answer cho WebRTC để đạt độ mượt tối đa (Ultra-Smooth):
 * 1. Chống bóp bitrate đột ngột (Google Congestion Control - GCC):
 *    - Thêm `x-google-min-bitrate`: Thiết lập sàn bitrate cố định (55% target),
 *      chặn hiện tượng mờ tịt và giật khung hình khi camera/game lia nhanh.
 *    - Thêm `x-google-start-bitrate`: Khởi động ngay gần ngưỡng target (95%),
 *      tránh giai đoạn khởi động chậm chạp (ramp-up lag).
 *    - Thêm `x-google-max-bitrate`: Giới hạn trần để tránh bufferbloat.
 * 2. Cấu hình trần băng thông video qua `b=AS` (kbps) và `b=TIAS` (bps).
 * 3. Bảo vệ âm thanh (Opus In-band FEC):
 *    - Bật `useinbandfec=1` cho codec Opus để client tự vá gói audio rớt mà
 *      không cần gửi yêu cầu truyền lại (0ms audio stutter).
 */

export type SdpOptimizationOptions = {
  bitrateKbps: number;
  fps?: number;
};

export function optimizeSdpForUltraSmooth(
  sdp: string,
  options: SdpOptimizationOptions,
): string {
  if (!sdp || typeof sdp !== 'string') return sdp;

  const { bitrateKbps, fps = 60 } = options;
  if (bitrateKbps <= 0) return sdp;

  // Sàn an toàn: tối thiểu 55% target bitrate (và không dưới 2000 kbps nếu target >= 2000)
  const minBitrate = Math.max(
    Math.min(2000, bitrateKbps),
    Math.round(bitrateKbps * 0.55),
  );
  const startBitrate = Math.round(bitrateKbps * 0.95);
  const maxBitrate = Math.round(bitrateKbps * 1.25);

  const lines = sdp.split(/\r?\n/);
  const result: string[] = [];

  let currentMedia: 'audio' | 'video' | 'data' | null = null;
  const videoPayloadTypes = new Set<string>();
  const audioPayloadTypes = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('m=video ')) {
      currentMedia = 'video';
      const parts = line.trim().split(/\s+/);
      for (let p = 3; p < parts.length; p++) {
        if (parts[p]) videoPayloadTypes.add(parts[p]);
      }
      result.push(line);
      // Chèn trần băng thông ngay dưới m=video
      result.push(`b=AS:${maxBitrate}`);
      result.push(`b=TIAS:${maxBitrate * 1000}`);
      continue;
    } else if (line.startsWith('m=audio ')) {
      currentMedia = 'audio';
      const parts = line.trim().split(/\s+/);
      for (let p = 3; p < parts.length; p++) {
        if (parts[p]) audioPayloadTypes.add(parts[p]);
      }
      result.push(line);
      continue;
    } else if (line.startsWith('m=')) {
      currentMedia = 'data';
      result.push(line);
      continue;
    }

    if (currentMedia === 'video') {
      // Loại bỏ b=AS hoặc b=TIAS cũ nếu có vì ta đã chèn dòng mới
      if (line.startsWith('b=AS:') || line.startsWith('b=TIAS:')) {
        continue;
      }

      // Tinh chỉnh định dạng fmtp cho video
      if (line.startsWith('a=fmtp:')) {
        const colonIdx = line.indexOf(':');
        const spaceIdx = line.indexOf(' ', colonIdx);
        if (colonIdx !== -1 && spaceIdx !== -1) {
          const pt = line.slice(colonIdx + 1, spaceIdx);
          if (videoPayloadTypes.has(pt)) {
            let params = line.slice(spaceIdx + 1);

            if (!params.includes('x-google-min-bitrate')) {
              params += `;x-google-min-bitrate=${minBitrate}`;
            }
            if (!params.includes('x-google-start-bitrate')) {
              params += `;x-google-start-bitrate=${startBitrate}`;
            }
            if (!params.includes('x-google-max-bitrate')) {
              params += `;x-google-max-bitrate=${maxBitrate}`;
            }
            if (fps > 0 && !params.includes('max-fr')) {
              params += `;max-fr=${fps}`;
            }

            result.push(`a=fmtp:${pt} ${params}`);
            continue;
          }
        }
      }
    } else if (currentMedia === 'audio') {
      // Kích hoạt In-band FEC cho Opus Audio để chống giật âm thanh
      if (line.startsWith('a=fmtp:')) {
        const colonIdx = line.indexOf(':');
        const spaceIdx = line.indexOf(' ', colonIdx);
        if (colonIdx !== -1 && spaceIdx !== -1) {
          const pt = line.slice(colonIdx + 1, spaceIdx);
          if (audioPayloadTypes.has(pt)) {
            let params = line.slice(spaceIdx + 1);
            if (!params.includes('useinbandfec')) {
              params += ';useinbandfec=1';
            }
            result.push(`a=fmtp:${pt} ${params}`);
            continue;
          }
        }
      }
    }

    result.push(line);
  }

  return result.join('\r\n');
}
