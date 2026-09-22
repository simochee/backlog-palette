import { canonicalUrl } from '@/lib/nav/path';
import type { DisplayCacheEntry } from '@/lib/storage/items';

/**
 * 保存済みの表示キャッシュを正規形の URL に畳む（displayCache v3）。
 *
 * 正規化を入れるだけだと、旧 `/view/proj-1` と新 `/view/PROJ-1` は `pushVisit` から見て
 * 別の行なので両方残り、同じ課題が「最近開いた」に 2 行並ぶ。TTL 90 日のあいだ続く。
 * 解釈できない URL は触らずに残す（規則を増やしたときに拾えるようにするため）
 */
export function canonicalizeVisits(entries: readonly DisplayCacheEntry[]): DisplayCacheEntry[] {
  const byUrl = new Map<string, DisplayCacheEntry>();
  for (const entry of entries) {
    const url = canonicalUrl(entry.url) ?? entry.url;
    const kept = byUrl.get(url);
    // 同じ対象になった行は、新しく訪問した方の内容を残す。並びは元の順のまま
    if (kept === undefined || entry.visitedAt > kept.visitedAt) byUrl.set(url, { ...entry, url });
  }
  return [...byUrl.values()];
}
