import { useEffect } from 'react';
import { setCaptureMode, type CaptureMode } from 'jetsona-input';

// Nhiều màn có thể đòi chế độ bắt khác nhau (UI mặc định, stream khi vào phiên).
// Màn mở sau cùng thắng; đóng nó thì trở về chế độ của màn bên dưới.
const stack: Array<{ id: number; mode: CaptureMode }> = [];
let counter = 0;

function apply() {
  setCaptureMode(stack.length ? stack[stack.length - 1].mode : 'ui');
}

export function useCaptureMode(mode: CaptureMode, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const entry = { id: (counter += 1), mode };
    stack.push(entry);
    apply();
    return () => {
      const index = stack.findIndex((item) => item.id === entry.id);
      if (index >= 0) stack.splice(index, 1);
      apply();
    };
  }, [enabled, mode]);
}
