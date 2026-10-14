export type MultipathMode = 'hbs_dual_wifi' | 'dual_wifi' | 'wifi_cellular' | 'single_wifi';

export type MultipathStatusLike = {
  isMultipathActive: boolean;
  mode: MultipathMode;
};

export type AiDecision = {
  primaryRatio: number; // 0 - 100%
  secondaryRatio: number; // 0 - 100%
  recommendedBitrateMbps: number;
  targetBufferSec: number;
  redundancyActive: boolean;
  score: number;
};

/**
 * Thuật toán Tiny DRL Actor Scheduler (MARS & Pensieve)
 * Chạy tính toán cực nhanh (<1ms), không phụ thuộc vào React hay Native runtime.
 */
export function computeAiDecision(
  status: MultipathStatusLike,
  link1Rtt: number,
  link1Loss: number,
  link2Rtt: number,
  link2Loss: number,
  bufferSec: number,
  isCellular: boolean,
): AiDecision {
  const isMultipath = status.isMultipathActive;

  // 1. Chế độ Single-Path (1 Wi-Fi) -> Pensieve AI ABR
  if (!isMultipath) {
    let bitrate = 25; // Mbps
    let targetBuffer = 4.0; // Giây

    if (link1Loss > 3 || link1Rtt > 90 || bufferSec < 2.5) {
      // Giảm bitrate mạnh để chống gián đoạn (Penalty cho T_stall là cao nhất)
      bitrate = 10;
      targetBuffer = 6.5;
    } else if (link1Loss > 1 || link1Rtt > 50) {
      bitrate = 18;
      targetBuffer = 5.0;
    } else if (link1Rtt < 20 && link1Loss === 0 && bufferSec > 4.0) {
      bitrate = 35; // Rất mượt -> đẩy lên chất lượng cao nhất
      targetBuffer = 3.5;
    }

    return {
      primaryRatio: 100,
      secondaryRatio: 0,
      recommendedBitrateMbps: bitrate,
      targetBufferSec: targetBuffer,
      redundancyActive: false,
      score: 1.0,
    };
  }

  // 2. Chế độ Multi-Path (HBS Dual 5GHz hoặc Wi-Fi + 5G) -> MARS Scheduler
  const safeRtt1 = Math.max(8, link1Rtt);
  const safeRtt2 = Math.max(8, link2Rtt);

  // Điểm số chất lượng đường truyền (tỉ lệ nghịch với RTT và packet loss)
  const quality1 = (1000 / safeRtt1) * Math.max(0.05, 1 - link1Loss / 100);
  let quality2 = (1000 / safeRtt2) * Math.max(0.05, 1 - link2Loss / 100);

  // Nếu đường 2 là 5G Cellular, áp dụng hình phạt chi phí dữ liệu (Cost Penalty)
  // Chỉ bung 5G khi Wi-Fi 1 có dấu hiệu bất ổn
  if (isCellular) {
    if (link1Rtt < 30 && link1Loss < 0.5) {
      // Wi-Fi 1 đang rất tốt -> 5G chỉ giữ 10% standby
      quality2 = quality1 * 0.12;
    } else {
      // Wi-Fi 1 bị giật -> 5G cứu nguy lập tức
      quality2 = quality2 * 1.5;
    }
  }

  const totalQuality = quality1 + quality2;
  let p1Ratio = Math.round((quality1 / totalQuality) * 100);
  p1Ratio = Math.max(5, Math.min(95, p1Ratio));
  const p2Ratio = 100 - p1Ratio;

  // Quyết định Redundancy (Gửi lặp gói khẩn cấp cho I-frame)
  // Bật khi có độ trễ dao động lớn hoặc rớt gói trên 1 trong 2 đường
  const redundancyActive = link1Loss > 2 || link2Loss > 2 || link1Rtt > 60;

  // Tính bitrate tổng hợp khả dụng
  let aggregateBitrate = 30;
  if (status.mode === 'hbs_dual_wifi') {
    // 2 sóng 5GHz chạy song song trên Tab S9: băng thông dồi dào
    aggregateBitrate = redundancyActive ? 28 : 45;
  } else {
    aggregateBitrate = redundancyActive ? 20 : 32;
  }

  return {
    primaryRatio: p1Ratio,
    secondaryRatio: p2Ratio,
    recommendedBitrateMbps: aggregateBitrate,
    targetBufferSec: redundancyActive ? 5.5 : 4.0,
    redundancyActive,
    score: Math.min(1.0, totalQuality / 100),
  };
}
