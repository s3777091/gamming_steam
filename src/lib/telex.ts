// Bộ gõ Telex tối giản cho bàn phím ảo: áp từng phím vào từ đang gõ dở rồi trả về
// từ mới (aa -> â, ow -> ơ, uow -> ươ, dd -> đ, s/f/r/x/j đặt dấu, z bỏ dấu; gõ lặp
// lại cùng phím thì hoàn tác). Dấu thanh tự dời về đúng nguyên âm khi từ dài thêm.

const VOWELS: Record<string, string> = {
  a: 'aáàảãạ', ă: 'ăắằẳẵặ', â: 'âấầẩẫậ', e: 'eéèẻẽẹ', ê: 'êếềểễệ', i: 'iíìỉĩị',
  o: 'oóòỏõọ', ô: 'ôốồổỗộ', ơ: 'ơớờởỡợ', u: 'uúùủũụ', ư: 'ưứừửữự', y: 'yýỳỷỹỵ',
};
const TONE_KEYS: Record<string, number> = { s: 1, f: 2, r: 3, x: 4, j: 5 };
const MARKED = 'ăâêôơư';
const CIRCUMFLEX: Record<string, { from: string; to: string }> = {
  a: { from: 'aă', to: 'â' },
  e: { from: 'e', to: 'ê' },
  o: { from: 'oơ', to: 'ô' },
};
const HORN: Record<string, string> = { u: 'ư', o: 'ơ', a: 'ă' };
const UNHORN: Record<string, string> = { ư: 'u', ơ: 'o', ă: 'a' };

type Letter = { base: string; tone: number; upper: boolean };

const LOOKUP = new Map<string, { base: string; tone: number }>();
for (const [base, row] of Object.entries(VOWELS)) {
  Array.from(row).forEach((ch, tone) => LOOKUP.set(ch, { base, tone }));
}

function toLetter(ch: string): Letter {
  const lower = ch.toLowerCase();
  const hit = LOOKUP.get(lower);
  return { base: hit?.base ?? lower, tone: hit?.tone ?? 0, upper: ch !== lower };
}

function join(letters: Letter[]): string {
  return letters.map(({ base, tone, upper }) => {
    const ch = VOWELS[base] ? Array.from(VOWELS[base])[tone] : base;
    return upper ? ch.toUpperCase() : ch;
  }).join('');
}

const isVowel = (letter: Letter | undefined) => Boolean(letter && letter.base in VOWELS);

/** Vị trí cụm nguyên âm cuối cùng (bỏ u của "qu" và i của "gi" khi sau đó còn nguyên âm). */
function nucleus(letters: Letter[]): number[] {
  let end = letters.length - 1;
  while (end >= 0 && !isVowel(letters[end])) end -= 1;
  if (end < 0) return [];
  let start = end;
  while (start > 0 && isVowel(letters[start - 1])) start -= 1;
  const prev = letters[start - 1]?.base;
  if (end > start && ((prev === 'q' && letters[start].base === 'u') || (prev === 'g' && letters[start].base === 'i'))) {
    start += 1;
  }
  const run: number[] = [];
  for (let index = start; index <= end; index += 1) run.push(index);
  return run;
}

function tonePosition(letters: Letter[], run: number[]): number {
  const marked = run.filter((index) => MARKED.includes(letters[index].base));
  if (marked.length) return marked[marked.length - 1];
  if (run.length === 1) return run[0];
  if (run.length >= 3) return run[1];
  // Hai nguyên âm: có phụ âm cuối thì dấu nằm ở nguyên âm sau (hoàn), không thì nguyên âm đầu (hòa).
  return run[1] < letters.length - 1 ? run[1] : run[0];
}

/** Đặt `tone` (hoặc dấu đang có khi bỏ trống) vào đúng nguyên âm của từ. */
function place(letters: Letter[], tone?: number): string {
  let current = 0;
  for (const letter of letters) {
    if (letter.tone) current = letter.tone;
    letter.tone = 0;
  }
  const next = tone ?? current;
  const run = nucleus(letters);
  if (next && run.length) letters[tonePosition(letters, run)].tone = next;
  return join(letters);
}

export function applyTelex(word: string, key: string): string {
  const lower = key.toLowerCase();
  const letters = Array.from(word).map(toLetter);
  const run = nucleus(letters);
  const appendKey = () => {
    letters.push(toLetter(key));
    return place(letters);
  };

  if (lower in TONE_KEYS || lower === 'z') {
    if (!run.length) return appendKey();
    const current = letters.reduce((tone, letter) => tone || letter.tone, 0);
    const tone = lower === 'z' ? 0 : TONE_KEYS[lower];
    if (tone === current) {
      if (lower === 'z') return appendKey();
      place(letters, 0);
      return appendKey();
    }
    return place(letters, tone);
  }

  if (lower === 'd' && letters.length) {
    if (letters[0].base === 'd') {
      letters[0].base = 'đ';
      return place(letters);
    }
    if (letters[0].base === 'đ') {
      letters[0].base = 'd';
      return appendKey();
    }
  }

  const hat = CIRCUMFLEX[lower];
  if (hat) {
    const target = [...run].reverse().find((index) => hat.from.includes(letters[index].base) || letters[index].base === hat.to);
    if (target !== undefined) {
      if (letters[target].base === hat.to) {
        letters[target].base = lower;
        return appendKey();
      }
      letters[target].base = hat.to;
      return place(letters);
    }
  }

  if (lower === 'w') {
    if (!run.length) {
      letters.push({ base: 'ư', tone: 0, upper: key !== lower });
      return place(letters);
    }
    const pair = run.findIndex((index, n) => n + 1 < run.length
      && 'uư'.includes(letters[index].base) && 'oơ'.includes(letters[run[n + 1]].base)
      && !(letters[index].base === 'ư' && letters[run[n + 1]].base === 'ơ'));
    if (pair >= 0) {
      letters[run[pair]].base = 'ư';
      letters[run[pair + 1]].base = 'ơ';
      return place(letters);
    }
    const convertible = [...run].reverse().find((index) => letters[index].base in HORN);
    if (convertible !== undefined) {
      letters[convertible].base = HORN[letters[convertible].base];
      return place(letters);
    }
    const converted = run.filter((index) => letters[index].base in UNHORN);
    if (converted.length) {
      converted.forEach((index) => { letters[index].base = UNHORN[letters[index].base]; });
      return appendKey();
    }
  }

  return appendKey();
}

/** Phần khác nhau giữa hai lần gõ: xoá `erase` ký tự cuối rồi chèn `insert`. */
export function diffWord(before: string, after: string): { erase: number; insert: string } {
  const a = Array.from(before);
  const b = Array.from(after);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  return { erase: a.length - prefix, insert: b.slice(prefix).join('') };
}
