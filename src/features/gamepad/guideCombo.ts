// Tổ hợp thay cho nút Home: giữ Start + Select khoảng nửa giây để mở menu của app.
//
// Nhiều tay cầm Bluetooth gửi nút Home/Xbox/PS dưới dạng phím HOME của Android.
// Hệ thống thoát ra màn hình chính TRƯỚC khi app thấy phím đó, nên không app nào
// chặn được; tổ hợp này đi qua đường phím tay cầm bình thường nên luôn tới app.

import { addListener } from 'jetsona-input';

const PLAY = 0x0010; // Start
const BACK = 0x0020; // Select / View
export const GUIDE_COMBO_MASK = PLAY | BACK;
export const GUIDE_COMBO_HOLD_MS = 600;

/** Gọi `onTrigger` một lần mỗi khi Start + Select được giữ đủ lâu; trả về hàm huỷ. */
export function listenGuideCombo(onTrigger: () => void, holdMs = GUIDE_COMBO_HOLD_MS): () => void {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const fired = new Set<number>();

  const off = addListener('onGamepadState', (state) => {
    const held = (state.buttons & GUIDE_COMBO_MASK) === GUIDE_COMBO_MASK;
    const pending = timers.get(state.deviceId);
    if (held) {
      if (pending || fired.has(state.deviceId)) return;
      timers.set(state.deviceId, setTimeout(() => {
        timers.delete(state.deviceId);
        fired.add(state.deviceId);
        onTrigger();
      }, holdMs));
      return;
    }
    if (pending) { clearTimeout(pending); timers.delete(state.deviceId); }
    fired.delete(state.deviceId);
  });

  return () => {
    off();
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    fired.clear();
  };
}
