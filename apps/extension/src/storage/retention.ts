/**
 * ローカルに溜めた記録の保持規則（実装プラン §9）。
 *
 * 期間と件数の両方に上限を置く。期間だけだと 1 日に大量に開いたときに
 * 上限を超え、件数だけだと古い記録が減衰せずに残り続ける。
 */

export const RETENTION_DAYS = 90;
export const DISPLAY_CACHE_LIMIT = 5_000;
/*
 * 行動ログの件数上限。減衰の半減期が 14 日なので、これを超えるほど溜まった
 * 古い記録は並びをほとんど動かさない。書き込みのたびに配列全体を
 * 直列化する経路なので、効かない分まで抱えない。
 */
export const ACTIVITY_LIMIT = 5_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type Aged = { readonly lastSeenAt: number };

export function isExpired(entry: Aged, now: number, days = RETENTION_DAYS): boolean {
  return now - entry.lastSeenAt > days * DAY_MS;
}

/**
 * 期限切れを落としたうえで、件数上限に収まるまで古い順に捨てる。
 *
 * 入力の順序に依存しない。ストレージから読んだオブジェクトの
 * キー順は保証されないため、必ず lastSeenAt で並べ直す。
 */
export function prune<T extends Aged>(
  entries: Readonly<Record<string, T>>,
  now: number,
  options?: { limit?: number; days?: number },
): Record<string, T> {
  const limit = options?.limit ?? DISPLAY_CACHE_LIMIT;
  const days = options?.days ?? RETENTION_DAYS;

  const alive = Object.entries(entries)
    .filter(([, entry]) => !isExpired(entry, now, days))
    .sort(([, a], [, b]) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, limit);

  return Object.fromEntries(alive);
}

export function pruneList<T extends { readonly at: number }>(
  events: readonly T[],
  now: number,
  options?: { limit?: number; days?: number },
): T[] {
  const limit = options?.limit ?? Number.POSITIVE_INFINITY;
  const days = options?.days ?? RETENTION_DAYS;

  return events
    .filter((event) => now - event.at <= days * DAY_MS)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
