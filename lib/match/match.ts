import { fold, type NormalizedQuery } from '@/lib/query/normalize';

export type MatchTarget = {
  /** 主テキスト（ページ名・件名・プロジェクト名） */
  text: string;
  /** 別名。英字の別名とかなの読みを混ぜて持つ。ローマ字の読み替えはここにだけ当てる（D-15） */
  aliases?: readonly string[];
};

/** 一致の強さ。並びはこの順で、同じ強さの中だけ個人化が効く（D-16） */
export const strengths = ['exact', 'prefix', 'substring'] as const;
export type MatchStrength = (typeof strengths)[number];

export type MatchResult = {
  strength: MatchStrength;
  /** タイトル本文への一致か、別名経由か。同じ強さならタイトル経由が先 */
  via: 'text' | 'alias';
};

const NO_ALIASES: readonly string[] = [];

function strengthOf(query: string, candidate: string): MatchStrength | undefined {
  if (candidate === query) return 'exact';
  const at = candidate.indexOf(query);
  if (at === 0) return 'prefix';
  if (at > 0) return 'substring';
  return undefined;
}

export function rankOf(strength: MatchStrength): number {
  return strengths.indexOf(strength);
}

function stronger(a: MatchResult | undefined, b: MatchResult | undefined): MatchResult | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const byStrength = rankOf(a.strength) - rankOf(b.strength);
  if (byStrength !== 0) return byStrength < 0 ? a : b;
  return a.via === 'text' ? a : b;
}

function matchAliases(query: string, aliases: readonly string[]): MatchResult | undefined {
  let best: MatchResult | undefined;
  for (const alias of aliases) {
    const strength = strengthOf(query, fold(alias));
    if (strength !== undefined) best = stronger(best, { strength, via: 'alias' });
  }
  return best;
}

/**
 * 正規形どうしで比べる（palette.md §4）。ローマ字のかな読み替えは別名にだけ当てる。
 * タイトルに当てると `wiki` が `うぃき` として英字のタイトルを取りこぼし、
 * 課題キーのような英字の語が読み替えの残骸で誤って当たる。
 */
export function match(query: NormalizedQuery, target: MatchTarget): MatchResult | undefined {
  if (query.folded === '') return undefined;

  const aliases = target.aliases ?? NO_ALIASES;
  const textStrength = strengthOf(query.folded, fold(target.text));
  let best: MatchResult | undefined =
    textStrength === undefined ? undefined : { strength: textStrength, via: 'text' };

  best = stronger(best, matchAliases(query.folded, aliases));
  if (query.kana !== undefined) best = stronger(best, matchAliases(query.kana, aliases));
  return best;
}

/** 強いローカル一致 = 前方一致以上（§4）。候補を検索行より上に出す基準 */
export function isStrong(result?: MatchResult): boolean {
  return result !== undefined && result.strength !== 'substring';
}
