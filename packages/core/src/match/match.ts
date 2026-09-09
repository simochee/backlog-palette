import { normalize } from '../query/normalize.ts';

export type MatchTarget = {
  /** 主テキスト（ページ名・件名・プロジェクト名など） */
  text: string;
  /** 別名。日本語プロジェクト名に対する英字プロジェクトキーなど */
  aliases?: readonly string[];
};

export type MatchResult = {
  /** 0 で不一致、大きいほど良い一致 */
  score: number;
  /** ハイライト用。text 上の [開始, 終了) の配列。別名経由の一致なら空 */
  ranges: readonly (readonly [number, number])[];
};

/**
 * 一致の強さは帯で分ける（§7.2）。帯の幅より加点の幅を小さく取るので、
 * 同じ帯の中でどれだけ加点が積もっても上位の帯を追い越さない。
 */
const EXACT = 1000;
const PREFIX = 800;
const SUBSTRING = 600;
const SUBSTRING_WORD_HEAD_BONUS = 60;
const SUBSTRING_OFFSET_PENALTY_LIMIT = 50;
const SUBSEQUENCE = 100;
const SUBSEQUENCE_QUALITY_SPAN = 300;
const CONTIGUITY_WEIGHT = 0.6;
const WORD_HEAD_WEIGHT = 0.4;
const ALIAS_FACTOR = 0.95;

const NO_RANGES: readonly (readonly [number, number])[] = [];
const NO_ALIASES: readonly string[] = [];
const NO_MATCH: MatchResult = { score: 0, ranges: NO_RANGES };

export function match(query: string, target: MatchTarget): MatchResult {
  const normalized = normalize(query).trim();
  if (normalized === '') return NO_MATCH;

  let best = matchFolded(normalized, fold(target.text));

  for (const alias of target.aliases ?? NO_ALIASES) {
    const score = Math.round(matchFolded(normalized, fold(alias)).score * ALIAS_FACTOR);
    if (score > best.score) best = { score, ranges: NO_RANGES };
  }

  return best;
}

type Folded = {
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

function fold(text: string): Folded {
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

function matchFolded(query: string, folded: Folded): MatchResult {
  const { value } = folded;

  if (value === query) {
    return { score: EXACT, ranges: [rangeOf(folded, 0, query.length - 1)] };
  }

  const at = value.indexOf(query);
  if (at === 0) {
    return { score: PREFIX, ranges: [rangeOf(folded, 0, query.length - 1)] };
  }
  if (at > 0) {
    const bonus = isWordHead(folded, at) ? SUBSTRING_WORD_HEAD_BONUS : 0;
    const penalty = Math.min(at, SUBSTRING_OFFSET_PENALTY_LIMIT);
    return {
      score: SUBSTRING + bonus - penalty,
      ranges: [rangeOf(folded, at, at + query.length - 1)],
    };
  }

  return matchSubsequence(query, folded);
}

function matchSubsequence(query: string, folded: Folded): MatchResult {
  const { value } = folded;
  const positions: number[] = [];

  let after = 0;
  for (let i = 0; i < query.length; i += 1) {
    const found = value.indexOf(query.charAt(i), after);
    if (found === -1) return NO_MATCH;
    positions.push(found);
    after = found + 1;
  }

  tighten(query, value, positions);

  let contiguous = 0;
  let wordHeads = 0;
  for (let i = 0; i < positions.length; i += 1) {
    const at = positions[i] ?? 0;
    if (i > 0 && at === (positions[i - 1] ?? 0) + 1) contiguous += 1;
    if (isWordHead(folded, at)) wordHeads += 1;
  }

  const quality =
    (CONTIGUITY_WEIGHT * contiguous + WORD_HEAD_WEIGHT * wordHeads) / positions.length;

  return {
    score: SUBSEQUENCE + Math.round(SUBSEQUENCE_QUALITY_SPAN * quality),
    ranges: rangesOf(folded, positions),
  };
}

/**
 * 前向きに見つけた並びを、末尾から詰め直す。前向きだけだと最初に見つかった
 * 文字に食いつき、後ろにあるより固まった一致（連続・語頭）を見落とす。
 * すべての並べ方を試す最適整列は、1 打鍵の予算（§14）に対して重い。
 */
function tighten(query: string, value: string, positions: number[]): void {
  let until = positions[positions.length - 1] ?? 0;
  for (let i = query.length - 1; i >= 0; i -= 1) {
    const found = value.lastIndexOf(query.charAt(i), until);
    positions[i] = found;
    until = found - 1;
  }
}

type CharClass = 'digit' | 'latin' | 'kana' | 'ideograph' | 'letter' | 'separator';

const LETTER = /\p{L}/u;

function classOf(text: string, index: number): CharClass {
  const code = text.charCodeAt(index);
  if (code >= 0x30 && code <= 0x39) return 'digit';
  if (code >= 0x61 && code <= 0x7a) return 'latin';
  if (isKana(code)) return 'kana';
  if (isIdeograph(code)) return 'ideograph';
  return LETTER.test(text.charAt(index)) ? 'letter' : 'separator';
}

function isKana(code: number): boolean {
  return (
    (code >= 0x3041 && code <= 0x3096) ||
    (code >= 0x309d && code <= 0x309f) ||
    (code >= 0x30a1 && code <= 0x30fa) ||
    (code >= 0x30fc && code <= 0x30fe)
  );
}

function isIdeograph(code: number): boolean {
  return (
    (code >= 0x3005 && code <= 0x3007) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff)
  );
}

function isWordHead(folded: Folded, index: number): boolean {
  if (index === 0) return true;

  const previous = classOf(folded.value, index - 1);
  if (previous === 'separator') return true;
  if (previous !== classOf(folded.value, index)) return true;

  return startsUppercaseRun(folded, index);
}

/** 大文字の切れ目は正規形には残らないので、元テキストで見る */
function startsUppercaseRun(folded: Folded, index: number): boolean {
  const at = folded.origin?.[index] ?? index;
  return at > 0 && isUppercase(folded.source, at) && !isUppercase(folded.source, at - 1);
}

function isUppercase(text: string, index: number): boolean {
  const code = text.charCodeAt(index);
  return (code >= 0x41 && code <= 0x5a) || (code >= 0xff21 && code <= 0xff3a);
}

function rangesOf(folded: Folded, positions: readonly number[]): readonly [number, number][] {
  const ranges: [number, number][] = [];

  let start = positions[0] ?? 0;
  let previous = start;
  for (let i = 1; i < positions.length; i += 1) {
    const at = positions[i] ?? 0;
    if (at !== previous + 1) {
      ranges.push(rangeOf(folded, start, previous));
      start = at;
    }
    previous = at;
  }
  ranges.push(rangeOf(folded, start, previous));

  return ranges;
}

function rangeOf(folded: Folded, first: number, last: number): [number, number] {
  return [originOf(folded, first), originEndOf(folded, last)];
}

function originOf(folded: Folded, index: number): number {
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
