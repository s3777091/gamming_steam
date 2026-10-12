// Người dùng không đọc log — họ đọc một dòng chữ và quyết định làm gì tiếp.
//
// Mọi lỗi kỹ thuật (AbortError, ECONNREFUSED, "WoL upstream error: The
// operation was aborted due to timeout") đều phải đi qua đây trước khi lên
// màn hình. Quy tắc: một câu tiếng Việt, nói *chuyện gì đang xảy ra* và
// *nên làm gì*, không tên giao thức, không mã lỗi.
//
// Port nguyên văn từ jetsona-ui/src/lib/friendly.ts — logic thuần, không phụ
// thuộc DOM.

/**
 * Bóc một giá trị lỗi bất kỳ thành chuỗi ĐỌC ĐƯỢC.
 *
 * `String(value)` trên object cho ra "[object Object]" — một chuỗi vô nghĩa đã
 * từng lên thẳng màn hình phiên điều khiển, che mất lỗi thật và khiến không ai
 * biết vì sao không kết nối được. Cả `new Error(obj)` cũng dính: message của nó
 * thành đúng chuỗi đó.
 *
 * Nên object phải được bóc theo các khoá lỗi thường gặp trước, và chỉ khi bất
 * lực mới rơi về JSON — vẫn còn đọc được, khác hẳn "[object Object]".
 */
export function describeError(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Error) {
    // new Error(obj) -> message = "[object Object]": bóc tiếp phần cause/nguyên bản.
    const message = value.message.trim();
    if (message && message !== '[object Object]') return message;
    return describeError((value as Error & { cause?: unknown }).cause) || value.name;
  }
  if (typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'error_description', 'msg', 'detail', 'reason']) {
      const nested = bag[key];
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
      // { error: { message } } — hình dạng lỗi quen thuộc của Supabase/PostgREST.
      if (nested && typeof nested === 'object') {
        const deep = describeError(nested);
        if (deep) return deep;
      }
    }
    try {
      const json = JSON.stringify(value);
      if (json && json !== '{}') return json.slice(0, 300);
    } catch {
      // object có vòng lặp tham chiếu — rơi xuống dưới.
    }
    return '';
  }
  return String(value);
}

/** Lỗi khi gọi sang một dịch vụ ở xa (Jetson, PC, service phiên). */
export function friendlyUpstreamError(error: unknown, subject = 'máy'): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  const text = raw.toLowerCase();

  if (text.includes('timeout') || text.includes('abort') || text.includes('timedout')) {
    return `Chưa nhận được trả lời từ ${subject}. Mạng ở nhà có thể đang chậm, hãy thử lại sau vài giây.`;
  }
  if (
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('ehostunreach') ||
    text.includes('econnreset') ||
    text.includes('socket') ||
    text.includes('fetch failed')
  ) {
    return `Không liên lạc được với ${subject}. Kiểm tra kết nối mạng ở nhà rồi thử lại.`;
  }
  if (text.includes('not configured') || text.includes('chưa cấu hình')) {
    return 'Tính năng này chưa được bật trên máy chủ.';
  }
  return `Không thực hiện được lúc này. Thử lại sau ít phút.`;
}

/**
 * Lọc câu trả lời lỗi của một API nội bộ. Server đã cố nói tiếng Việt tử tế;
 * nếu chuỗi lọt ra vẫn còn dấu vết kỹ thuật thì thay hẳn bằng câu chung.
 */
export function friendlyMessage(message: unknown, subject = 'máy'): string {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) return `Không liên lạc được với ${subject}. Thử lại sau ít phút.`;
  const technical =
    /error|exception|abort|timeout|econn|enotfound|undefined|null|http\s*\d|\bstatus\b|upstream|socket|failed/i;
  // Tiếng Việt có dấu = câu đã được dịch sẵn ở server, giữ nguyên.
  if (/[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỴỷỹ]/i.test(text)) {
    return text;
  }
  return technical.test(text) ? friendlyUpstreamError(text, subject) : text;
}
