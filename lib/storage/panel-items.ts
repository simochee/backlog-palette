import { storage } from '#imports';
import type { SearchState } from '@/lib/share';

/**
 * パレットから `⌘→` で渡された検索（surfaces.md §5.1）。サイドパネルは読み取ったら消す。
 *
 * 面をまたぐ 1 回きりの受け渡しなので、DB のコレクションにはしない。パネルが開くのは
 * この item を書いた直後で、読まれなければ次に開いたときに復元される
 */
export const panelRequest = storage.defineItem<{ state: SearchState; at: number } | null>(
  'local:panelRequest',
  { fallback: null, version: 1 },
);

/**
 * パネルが最後に走らせた検索。ツールバーから開き直したときに復元する（surfaces.md §5.1）。
 * パネルは閉じると文書ごと破棄され、URL の hash に載せた検索状態も残らない。
 *
 * local ではなく session に置く。ブラウザを閉じれば消えるので、学習オフや履歴消去の
 * 対象（行動ログ・検索履歴）を増やさずに「前回の状態」を保てる
 */
export const panelLastSearch = storage.defineItem<SearchState | null>('session:panelLastSearch', {
  fallback: null,
  version: 1,
});
