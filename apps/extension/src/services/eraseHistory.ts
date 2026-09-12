import { clearHistory } from '../storage/displayCache.ts';
import { clearActivity } from './activity/index.ts';
import { clearSearchHistory } from './searchHistory.ts';

/**
 * 設定画面の「履歴の消去」（実装プラン §9）。
 *
 * 端末に残した記録をまとめて消す。一部だけ残すと、表示は消えたのに
 * 並びや候補には効き続ける状態になる。
 */
export async function eraseHistory(): Promise<void> {
  await Promise.all([clearHistory(), clearActivity(), clearSearchHistory()]);
}
