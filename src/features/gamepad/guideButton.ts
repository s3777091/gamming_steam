// Nhấn nút View / Select (nút hai ô vuông bên trái tay cầm) để mở menu của app.
// Đọc từ trạng thái tay cầm bình thường nên không phụ thuộc nút đặc biệt hoặc cách
// từng mẫu tay cầm ánh xạ phím (có mẫu báo BUTTON_SELECT, có mẫu báo BACK).

import { addListener } from 'jetsona-input';

/** Bit của nút View / Select trong `buttons` của trạng thái tay cầm. */
export const GUIDE_BUTTON = 0x0020;

/** Gọi `onTrigger` mỗi lần nút View / Select vừa được nhấn xuống; trả về hàm huỷ. */
export function listenGuideButton(onTrigger: () => void): () => void {
  const held = new Set<number>();

  const off = addListener('onGamepadState', (state) => {
    const down = (state.buttons & GUIDE_BUTTON) !== 0;
    if (!down) { held.delete(state.deviceId); return; }
    if (held.has(state.deviceId)) return;
    held.add(state.deviceId);
    onTrigger();
  });

  return () => {
    off();
    held.clear();
  };
}
