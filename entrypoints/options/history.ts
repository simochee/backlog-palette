import { displayCache } from '@/lib/storage/items';
import { activity, queryDict, searchHistory, transitions } from '@/lib/storage/palette-items';

/**
 * 「履歴を消去」（surfaces.md §2）。行動ログ・遷移パターン・検索履歴・クエリ辞書・表示キャッシュを
 * 空にする。接続（spaces）と鍵（apiKeys）は残す。
 */
export async function clearHistory(): Promise<void> {
  await Promise.all([
    activity.setValue([]),
    transitions.setValue([]),
    searchHistory.setValue([]),
    queryDict.setValue([]),
    displayCache.setValue([]),
  ]);
}
