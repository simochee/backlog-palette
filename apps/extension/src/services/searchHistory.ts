import { searchHistoryItem } from '../storage/schema.ts';

/**
 * 検索クエリの履歴（実装プラン §9 の `local:searchHistory`・§5.3）。
 *
 * 残すのはクエリの文字列だけで、結果も件数も持たない。空入力のときの候補と
 * `↑` での再入力がここから作られる。
 */

/** 直近 50 件（§9） */
export const SEARCH_HISTORY_LIMIT = 50;

/** 新しいものから順に並べる。同じクエリは最新の 1 件に寄せる */
export function withQuery(
  history: readonly string[],
  query: string,
  limit = SEARCH_HISTORY_LIMIT,
): readonly string[] {
  const trimmed = query.trim();
  if (trimmed === '') return history;

  return [trimmed, ...history.filter((entry) => entry !== trimmed)].slice(0, limit);
}

export async function rememberQuery(query: string): Promise<readonly string[]> {
  const next = withQuery(await searchHistoryItem.getValue(), query);
  await searchHistoryItem.setValue([...next]);
  return next;
}

export async function recentQueries(): Promise<readonly string[]> {
  return await searchHistoryItem.getValue();
}

export async function clearSearchHistory(): Promise<void> {
  await searchHistoryItem.removeValue();
}
