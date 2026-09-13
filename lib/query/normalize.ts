import { romajiToKana } from './romaji';

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KANA_OFFSET = 0x60;

function katakanaToHiragana(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    out +=
      code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - KANA_OFFSET)
        : char;
  }
  return out;
}

/**
 * 照合に使う正規形（palette.md §4）。NFKC → カタカナをひらがなへ → 小文字。
 * 候補側（ページ名・件名・別名）と入力側の両方をこれに畳んで比べる。
 *
 * 課題キーの判定はこの関数を通さない原文で行う（backlog-facts.md §2.2）。
 * 畳むと大文字小文字が失われ、`proj-123` を課題キーとして扱うか決められない。
 */
export function fold(text: string): string {
  return katakanaToHiragana(text.normalize('NFKC')).toLowerCase();
}

export type NormalizedQuery = {
  /** 正規形。候補の正規形と直接比べる */
  folded: string;
  /** ローマ字をかなに読み替えた形。かなの別名に届かせる（D-15）。読み替えで変わらないときは持たない */
  kana: string | undefined;
};

export function normalize(input: string): NormalizedQuery {
  const folded = fold(input).trim();
  const kana = romajiToKana(folded);
  return { folded, kana: kana === folded ? undefined : kana };
}
