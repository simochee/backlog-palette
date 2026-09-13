import { recencyWeight } from './frecency';

/** 語 → 開いた対象の 1 件。語は照合と同じ fold を通した形で持つ */
export type QueryDictEvent = {
  query: string;
  entityId: string;
  /** 同じ語で同じ対象を開いた回数 */
  count: number;
  /** 最後に開いた時刻（エポックミリ秒） */
  at: number;
};

export const QUERY_DICT_LIMIT = 500;

/**
 * 語が同じ記録だけを加点する。同じ強さ・同じ文脈の候補の中でだけ効く（D-16 の介入ルール）ので、
 * frecency と同じ段に足す。回数 × 直近性で、頻度の重みより十分大きくして「この語ではこれ」を勝たせる
 */
export const QUERY_DICT_WEIGHT = 10;

export function queryDictScores(
  records: readonly QueryDictEvent[],
  query: string,
  now: number,
): ReadonlyMap<string, number> {
  const scores = new Map<string, number>();
  for (const record of records) {
    if (record.query !== query) continue;
    const weight = record.count * recencyWeight(record.at, now) * QUERY_DICT_WEIGHT;
    scores.set(record.entityId, (scores.get(record.entityId) ?? 0) + weight);
  }
  return scores;
}

/** 同じ語と対象は 1 件にまとめて回数を増やす。上限を超えたら最後に開いた時刻が古いものから捨てる */
export function upsertQueryDict(
  records: readonly QueryDictEvent[],
  query: string,
  entityId: string,
  now: number,
  limit: number = QUERY_DICT_LIMIT,
): QueryDictEvent[] {
  const known = records.find((record) => record.query === query && record.entityId === entityId);
  const updated: QueryDictEvent = {
    query,
    entityId,
    count: (known?.count ?? 0) + 1,
    at: now,
  };
  const rest = records.filter((record) => record !== known);
  return [updated, ...rest].toSorted((a, b) => b.at - a.at).slice(0, limit);
}
