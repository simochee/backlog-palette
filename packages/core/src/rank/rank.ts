export type MatchKind = 'exactIssueKey' | 'exactCommand' | 'partial';

export type CandidateContext = 'currentProject' | 'currentSpace' | 'other';

export type Candidate = {
  id: string;
  /** 一致の質。core/match の score（0〜1 に正規化済み）。完全一致は matchKind で示す */
  matchScore: number;
  matchKind: MatchKind;
  /** frecency() の結果 */
  frecency: number;
  /** 現在のスコープとの関係 */
  context: CandidateContext;
};

/**
 * 一致の質を比べる粗さ。この幅より細かい matchScore の差は「同点」として扱い、
 * 学習（frecency・文脈）で並びを決める（§7.3 の不変条件 4）。
 *
 * 0.05 は「一致の質の差として人が説明できる最小単位」を見積もった値。core/match の
 * score は 0〜1 に正規化されており、連続一致ボーナス 1 個分の寄与がおおよそこの幅に収まる。
 * これより細かい差は前処理（かな・全角）の揺れで簡単に反転するため、差として扱わない。
 * HALF_LIFE_DAYS と同じく実測で調整する初期値。
 */
export const MATCH_SCORE_TIE_BAND = 0.05;

export const CONTEXT_BOOST: Record<CandidateContext, number> = {
  currentProject: 1.0,
  currentSpace: 0.5,
  other: 0,
};

function isExact(candidate: Candidate): boolean {
  return candidate.matchKind === 'exactIssueKey' || candidate.matchKind === 'exactCommand';
}

/**
 * 「差が MATCH_SCORE_TIE_BAND 未満なら同点」と差分の絶対値で判定しない。
 * その判定は推移律を満たさず（a≈b, b≈c でも a≉c になりうる）、比較結果が
 * 配列の並び順に依存する。同じ入力で同じ並びにならないと P6（筋肉記憶）が崩れるので、
 * 帯に量子化してから比べる。境界をまたぐ僅差が別の帯に落ちるのはこの引き換え。
 */
function matchBand(candidate: Candidate): number {
  return Math.floor(candidate.matchScore / MATCH_SCORE_TIE_BAND);
}

function personalization(candidate: Candidate): number {
  return candidate.frecency + CONTEXT_BOOST[candidate.context];
}

function compare(a: Candidate, b: Candidate): number {
  if (isExact(a) !== isExact(b)) return isExact(a) ? -1 : 1;

  const byMatch = matchBand(b) - matchBand(a);
  if (byMatch !== 0) return byMatch;

  if (!isExact(a)) {
    const byPersonalization = personalization(b) - personalization(a);
    if (byPersonalization !== 0) return byPersonalization;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * セクション内の並びだけを決める。セクションを受け取らないのは、セクションの順序を
 * 個人化から切り離す（§7.3 の不変条件 2・3）ため。セクションをまたぐ並び替えは提供しない。
 */
export function rankWithinSection(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort(compare);
}
