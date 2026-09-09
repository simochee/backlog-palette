import { prune } from './retention.ts';
import { type DisplayCacheEntry, displayCacheItem } from './schema.ts';

export function cacheKey(spaceKey: string, id: string): string {
  return `${spaceKey}/${id}`;
}

/**
 * 閲覧した項目を記録する。API は呼ばない（§9 の表示キャッシュ）。
 *
 * 書き込みのたびに間引く。別途の掃除処理を持つと、掃除が走る前に
 * ストレージ上限へ当たる経路が残る。
 */
export async function rememberVisit(
  spaceKey: string,
  id: string,
  entry: Omit<DisplayCacheEntry, 'lastSeenAt'>,
  now: number,
): Promise<void> {
  const current = await displayCacheItem.getValue();
  const next = prune({ ...current, [cacheKey(spaceKey, id)]: { ...entry, lastSeenAt: now } }, now);
  await displayCacheItem.setValue(next);
}

export async function recentVisits(now: number, limit = 20): Promise<DisplayCacheEntry[]> {
  const current = await displayCacheItem.getValue();
  return Object.values(prune(current, now))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, limit);
}

export async function clearHistory(): Promise<void> {
  await displayCacheItem.removeValue();
}
