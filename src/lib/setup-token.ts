// Setup token (UUID v4) + setup_generation guard. Port từ
// jetsona-ui/src/lib/stream-setup-lock.ts (phần token) và mở rộng thêm
// `isSafeSetupGeneration` cho contract P0. Pure: không phụ thuộc React Native.
//
// Mỗi lần mở stream sinh một token UUID v4 mới — không dùng lại, không mặc định.
// `setup_generation` là bigint ở Postgres và có thể về client dạng string, nên
// guard phải chấp nhận cả hai và chỉ nhận số nguyên >= 1.

/** UUID-v4 lease token, kể cả môi trường không có crypto.randomUUID(). */
export function createStreamSetupToken(randomBytes?: Uint8Array): string {
  if (!randomBytes && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  const bytes = randomBytes ? Uint8Array.from(randomBytes) : new Uint8Array(16);
  if (bytes.length !== 16) throw new Error('A setup token needs exactly 16 bytes.');
  if (!randomBytes) {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * True khi `value` là một setup_generation an toàn dùng được: số nguyên >= 1.
 *
 * Postgres bigint thường về client dạng chuỗi, nên chấp nhận cả number lẫn chuỗi
 * số. Bất kỳ giá trị nào <= 0, không nguyên, hay không phải số đều bị bác — cũ
 * dùng làm "không có generation" và không bao giờ release phiên kế cận.
 */
export function isSafeSetupGeneration(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 1;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return false;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 1 && Number.isSafeInteger(parsed);
  }
  return false;
}

/** Chuẩn hoá về number, hoặc null khi không an toàn. */
export function asSetupGeneration(value: unknown): number | null {
  return isSafeSetupGeneration(value) ? Number(value) : null;
}