import type { StreamSettings } from './stream-settings';

// Bản native của CustomEvent 'jetsona:stream-settings-updated' bên web: màn cài
// đặt báo cho phiên đang chạy (và các màn khác) đọc lại cấu hình.
type Listener = (settings: StreamSettings) => void;
const listeners = new Set<Listener>();

export function emitStreamSettings(settings: StreamSettings): void {
  listeners.forEach((listener) => listener(settings));
}

export function subscribeStreamSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
