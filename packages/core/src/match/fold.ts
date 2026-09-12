import { normalize } from '../query/normalize.ts';

/**
 * 正規形と元テキストの対応（§7.1・§7.2）。
 *
 * 一致は正規形の上で取り、ハイライトは元テキストの位置で返す。この 2 つを
 * 繋ぐのがこの型で、候補の照合（`match`）と本文の抜粋（`snippet`）が共有する。
 */
export type Folded = {
  readonly source: string;
  readonly value: string;
  /** value[i] に対応する source 上の開始位置。1 対 1 に畳めたときは持たない */
  readonly origin?: readonly number[];
};

/**
 * NFKC で形が変わらない文字だけの並び。半角カナ `ﾎﾞ` のように 2 文字が 1 文字へ
 * 畳まれる文字が混じると、正規化後の位置から元の位置へ戻せなくなる。
 *
 * 索引 5,000 件を打鍵ごとに走る（§14）ので、大半を占めるこの並びでは
 * 位置の対応表を作らず、正規形と元テキストの添字が一致することに頼る。
 */
const NFKC_STABLE = /^[ -~、。々-〇ぁ-ゖゝ-ゟァ-ヶ・-ヾ一-鿿]*$/;

export function fold(text: string): Folded {
  if (NFKC_STABLE.test(text)) return { source: text, value: normalize(text) };
  return foldByChunks(text);
}

/**
 * 揺れのある文字を含むときだけ、まとまりごとに正規化して対応表を作る。
 * 文字列全体を一度に正規化すると長さが変わり、ハイライト位置を元の
 * インデックスへ戻せない。まとまり単位なら「元の 1 まとまり = 正規形の n 文字」
 * の対応が残る。
 */
function foldByChunks(text: string): Folded {
  const origin: number[] = [];
  let value = '';
  let index = 0;

  while (index < text.length) {
    const end = chunkEnd(text, index);
    const chunk = normalize(text.slice(index, end));
    for (let i = 0; i < chunk.length; i += 1) origin.push(index);
    value += chunk;
    index = end;
  }

  return { source: text, value, origin };
}

/**
 * 結合文字とハングルの字母は前の文字と合成されうるので、同じまとまりに入れる。
 * まとまりを広く取りすぎてもハイライトが粗くなるだけだが、狭く取ると
 * 正規形が文字列全体を正規化した結果とずれる。
 */
const CHUNK_CONTINUATION = /[\p{M}ᄀ-ᇿﾞﾟﾠ-ￜ]/u;

function chunkEnd(text: string, start: number): number {
  let end = start + charWidthAt(text, start);
  while (end < text.length && continuesChunk(text, end)) {
    end += charWidthAt(text, end);
  }
  return end;
}

function charWidthAt(text: string, index: number): number {
  const code = text.codePointAt(index) ?? 0;
  return code > 0xffff ? 2 : 1;
}

function continuesChunk(text: string, index: number): boolean {
  const code = text.codePointAt(index) ?? 0;
  if (code < 0x0300) return false;
  return CHUNK_CONTINUATION.test(String.fromCodePoint(code));
}

/** 正規形の [first, last] を元テキストの [開始, 終了) へ写す */
export function sourceRange(folded: Folded, first: number, last: number): [number, number] {
  return [originOf(folded, first), originEndOf(folded, last)];
}

export function originOf(folded: Folded, index: number): number {
  return folded.origin?.[index] ?? index;
}

function originEndOf(folded: Folded, index: number): number {
  const { origin } = folded;
  if (origin === undefined) return index + 1;

  const at = origin[index] ?? 0;
  for (let i = index + 1; i < origin.length; i += 1) {
    const next = origin[i] ?? 0;
    if (next > at) return next;
  }
  return folded.source.length;
}
