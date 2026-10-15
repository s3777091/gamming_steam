export const API_TIMEOUT_MS = 20_000;

/** Bound the entire operation, including auth and reading the response body. */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal | null,
  timeoutMs = API_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(signal?.reason ?? new Error('Yêu cầu đã được hủy.'));
      controller.abort();
    };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new Error('Kết nối quá lâu. Vui lòng thử lại.'));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      deadline,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error('Yêu cầu đã được hủy.');
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}
