const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KANA_OFFSET = 0x60;

function katakanaToHiragana(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    out +=
      code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - KANA_OFFSET)
        : char;
  }
  return out;
}

/**
 * 一致判定に使う正規形へ畳む（docs/implementation-plan.md §7.1）。
 *
 * NFKC が全角英数・全角記号・半角カナをまとめて畳んでくれるので、
 * 記号ごとの対応表は持たない。カタカナ → ひらがなだけ NFKC の範囲外。
 *
 * 課題キーの判定はこの関数を通さない元の文字列で行う。畳むと
 * 大文字小文字が失われ、`proj-123` と `PROJ-123` を区別できなくなる。
 */
export function normalize(input: string): string {
  return katakanaToHiragana(input.normalize('NFKC')).toLowerCase();
}
