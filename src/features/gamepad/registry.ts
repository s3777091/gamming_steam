// Sổ đăng ký cho nút B (quay lại), LB/RB (đổi tab) và nút Home của tay cầm.
// Bên web các thành phần nghe CustomEvent trên window; native không có window
// nên dùng một ngăn xếp: thành phần mở sau cùng được hỏi trước.

import { playUiSound } from '@/features/sound/UiSoundProvider';

type Handler = () => boolean | void;

const backStack: Handler[] = [];
const tabHandlers = new Set<(direction: -1 | 1) => boolean | void>();
const guideHandlers = new Set<() => void>();

/** Đăng ký xử lý Back. Trả `false`/không trả gì nghĩa là đã xử lý xong. Trả `true` để nhường tầng dưới. */
export function pushBack(handler: Handler): () => void {
  backStack.push(handler);
  return () => {
    const index = backStack.lastIndexOf(handler);
    if (index >= 0) backStack.splice(index, 1);
  };
}

/** Gọi tầng trên cùng; trả true nếu có ai đó đã xử lý. */
export function dispatchBack(): boolean {
  for (let index = backStack.length - 1; index >= 0; index -= 1) {
    const result = backStack[index]();
    if (result !== true) {
      playUiSound('back');
      return true;
    }
  }
  return false;
}

export function onTabSwitch(handler: (direction: -1 | 1) => boolean | void): () => void {
  tabHandlers.add(handler);
  return () => { tabHandlers.delete(handler); };
}

export function dispatchTab(direction: -1 | 1): boolean {
  let handled = false;
  tabHandlers.forEach((handler) => {
    if (handler(direction) !== false) handled = true;
  });
  if (handled) playUiSound('navigate');
  return handled;
}

export function onGuide(handler: () => void): () => void {
  guideHandlers.add(handler);
  return () => { guideHandlers.delete(handler); };
}

export function dispatchGuide(): void {
  guideHandlers.forEach((handler) => handler());
}

// Trang kiểm tra tay cầm cần đọc tín hiệu mà không để D-pad/A điều khiển UI.
// Nút B (quay lại) vẫn hoạt động khi điều hướng bị tạm dừng.
let suspendCount = 0;

export function suspendCursor(): () => void {
  suspendCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suspendCount -= 1;
  };
}

export function isCursorSuspended(): boolean {
  return suspendCount > 0;
}
