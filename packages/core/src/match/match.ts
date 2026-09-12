import { normalize } from '../query/normalize.ts';
import { type Folded, fold, originOf, sourceRange } from './fold.ts';

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

function matchFolded(query: string, folded: Folded): MatchResult {
  const { value } = folded;

  if (value === query) {
    return { score: EXACT, ranges: [sourceRange(folded, 0, query.length - 1)] };
  }

  const at = value.indexOf(query);
  if (at === 0) {
    return { score: PREFIX, ranges: [sourceRange(folded, 0, query.length - 1)] };
  }
  if (at > 0) {
    const bonus = isWordHead(folded, at) ? SUBSTRING_WORD_HEAD_BONUS : 0;
    const penalty = Math.min(at, SUBSTRING_OFFSET_PENALTY_LIMIT);
    return {
      score: SUBSTRING + bonus - penalty,
      ranges: [sourceRange(folded, at, at + query.length - 1)],
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
  const at = originOf(folded, index);
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
      ranges.push(sourceRange(folded, start, previous));
      start = at;
    }
    previous = at;
  }
  ranges.push(sourceRange(folded, start, previous));

  return ranges;
}
