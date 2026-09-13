import { type MatchResult, rankOf } from '@/lib/match/match';

/** 現在のスコープとの関係。同じ強さの中でこの順に加点する（palette.md §4） */
export const contexts = ['currentProject', 'currentSpace', 'other'] as const;
export type RankContext = (typeof contexts)[number];

export type Ranked<T> = {
  id: string;
  item: T;
  match: MatchResult;
  /** 課題キー完全一致・コマンド名完全一致。個人化で動かない（決定済み: 筋肉記憶を守る） */
  pinned: boolean;
  context: RankContext;
  /** 同点の決め手として効く個人化のスコア。内訳は frecency（頻度 × 直近性）と語 → 対象の学習 */
  personalScore: number;
};

function compare(a: Ranked<unknown>, b: Ranked<unknown>): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

  const byStrength = rankOf(a.match.strength) - rankOf(b.match.strength);
  if (byStrength !== 0) return byStrength;
  if (a.match.via !== b.match.via) return a.match.via === 'text' ? -1 : 1;

  if (!a.pinned) {
    const byContext = contexts.indexOf(a.context) - contexts.indexOf(b.context);
    if (byContext !== 0) return byContext;
    if (a.personalScore !== b.personalScore) return b.personalScore - a.personalScore;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * セクション内の並びだけを決める。セクションの順序は固定で、個人化はその内側にだけ効く
 * （D-16 の介入ルール）。セクションをまたぐ並び替えは提供しない。
 */
export function rankWithinSection<R extends Ranked<unknown>>(entries: readonly R[]): R[] {
  return entries.toSorted(compare);
}
