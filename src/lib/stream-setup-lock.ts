// Setup lock trong một runtime: các nỗ lực setup cho CÙNG một tài nguyên stream
// không được chồng lên nhau. Port nguyên văn từ
// jetsona-ui/src/lib/stream-setup-lock.ts (phần lock). Pure.
//
// Unmount/remount nhanh (React) có thể khởi một nỗ lực thay thế khi nỗ lực cũ vẫn
// đang await `/display`; không có hàng đợi này, cleanup cũ sẽ đua claim thay thế.
// Tách lock khỏi token: hai file độc lập, mỗi cái có Map riêng.

const setupTails = new Map<string, Promise<void>>();

/**
 * Xin quyền là nỗ lực setup kế tiếp cho `resourceKey`. Trả về một hàm giải phóng;
 * chỉ gọi khi đã xong hẳn (claim thành công HOẶC lỗi). Nỗ lực kế tiếp chờ tail
 * của nỗ lực hiện tại giải phóng mới được chạy.
 */
export async function acquireStreamSetupLock(resourceKey: string): Promise<() => void> {
  const previous = setupTails.get(resourceKey) ?? Promise.resolve();
  let openGate: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  const tail = previous.catch(() => {}).then(() => gate);
  setupTails.set(resourceKey, tail);

  await previous.catch(() => {});
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openGate();
    if (setupTails.get(resourceKey) === tail) {
      void tail.finally(() => {
        if (setupTails.get(resourceKey) === tail) setupTails.delete(resourceKey);
      });
    }
  };
}