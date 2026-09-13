import { type DisplayCacheEntry, displayCache } from '@/lib/storage/items';

export const DISPLAY_CACHE_LIMIT = 500;
export const DISPLAY_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** 同じ URL は先頭に移し、上限を超えた古いものから落とす */
export function pushVisit(
  entries: readonly DisplayCacheEntry[],
  entry: DisplayCacheEntry,
  limit = DISPLAY_CACHE_LIMIT,
): DisplayCacheEntry[] {
  const rest = entries.filter((existing) => existing.url !== entry.url);
  return [entry, ...rest].slice(0, limit);
}

export function pruneVisits(
  entries: readonly DisplayCacheEntry[],
  now: number,
  ttlMs = DISPLAY_CACHE_TTL_MS,
  limit = DISPLAY_CACHE_LIMIT,
): DisplayCacheEntry[] {
  return entries.filter((entry) => now - entry.visitedAt <= ttlMs).slice(0, limit);
}

export async function recordVisit(entry: DisplayCacheEntry): Promise<void> {
  const entries = await displayCache.getValue();
  await displayCache.setValue(pushVisit(entries, entry));
}

export async function pruneDisplayCache(now = Date.now()): Promise<void> {
  const entries = await displayCache.getValue();
  await displayCache.setValue(pruneVisits(entries, now));
}
