// Chính sách lấp khung stream phía client. Phần hình học thuần (fullBleedStretch)
// nằm ở stream-geometry.ts — port nguyên văn từ jetsona-ui, không đụng vào.
//
// VÌ SAO CÓ FILE NÀY
// ------------------
// fullBleedStretch giả định host đã thương lượng được một mode ĐÚNG hình dạng máy
// đang xem (streamGeometryForTier → hostModeMatchingViewer), nên phần giãn còn lại
// chỉ là dư vài phần trăm. Khi PC không có mode nào khớp — desktop 16:10 mà điện
// thoại 19.5:9 — giãn đủ để lấp màn phải kéo tới ~39%: chữ và mặt người méo thấy
// rõ. Chặn trần ở mức mắt không nhận ra; phần còn thiếu để nguyên viền đen.
//
// Quan trọng hơn: render và input PHẢI đọc cùng một hình học. Trước đây
// RemoteScreen giãn full-bleed nhưng lại quy toạ độ chạm theo khung contain, nên
// mọi cú chạm bị dồn về giữa và dải hai bên thành vùng chết. Hai hàm dưới đây
// dùng chung một phép tính để chuyện đó không tái diễn.

import { fullBleedStretch, type DisplayGeometry } from '@/lib/stream-geometry';

/**
 * Trần giãn một trục. 5% nằm dưới ngưỡng mắt thường nhận ra méo, mà vẫn ăn bớt
 * được một phần viền đen. Đặt Infinity thì quay lại full-bleed như cũ (lấp kín
 * màn, chấp nhận méo); đặt 1 thì tắt hẳn, luôn giữ đúng tỷ lệ.
 */
export const MAX_FULL_BLEED_STRETCH = 1.05;

/** Khung hình thật sự được vẽ trên máy xem, sau khi đã chặn trần giãn. */
function renderedBox(stream: DisplayGeometry, viewer: DisplayGeometry, allowStretch: boolean) {
  const streamAspect = stream.width / Math.max(1, stream.height);
  const viewerAspect = viewer.width / Math.max(1, viewer.height);
  let width = viewer.width;
  let height = viewer.height;
  if (viewerAspect > streamAspect) width = height * streamAspect;
  else height = width / streamAspect;
  const stretch = allowStretch ? streamStretch(stream, viewer) : { scaleX: 1, scaleY: 1 };
  width *= stretch.scaleX;
  height *= stretch.scaleY;
  return { width, height, left: (viewer.width - width) / 2, top: (viewer.height - height) / 2 };
}

/** Hệ số giãn đã chặn trần, dùng thẳng cho transform của RTCView. */
export function streamStretch(
  stream: DisplayGeometry,
  viewer: DisplayGeometry,
): { scaleX: number; scaleY: number } {
  const { scaleX, scaleY } = fullBleedStretch(stream, viewer);
  return {
    scaleX: Math.min(scaleX, MAX_FULL_BLEED_STRETCH),
    scaleY: Math.min(scaleY, MAX_FULL_BLEED_STRETCH),
  };
}

/** Style transform cho RTCView. */
export function streamStretchStyle(stream: DisplayGeometry, viewer: DisplayGeometry) {
  const { scaleX, scaleY } = streamStretch(stream, viewer);
  return { transform: [{ scaleX }, { scaleY }] };
}

/**
 * Điểm chạm trên máy xem → toạ độ [0,1] trên khung stream. Chạm vào vùng viền đen
 * bị kẹp về mép, không phải bị dồn vào giữa.
 */
export function pointOnStream(
  x: number,
  y: number,
  stream: DisplayGeometry,
  viewer: DisplayGeometry,
  allowStretch = true,
): { x: number; y: number } {
  const box = renderedBox(stream, viewer, allowStretch);
  return {
    x: Math.min(1, Math.max(0, (x - box.left) / Math.max(1, box.width))),
    y: Math.min(1, Math.max(0, (y - box.top) / Math.max(1, box.height))),
  };
}
