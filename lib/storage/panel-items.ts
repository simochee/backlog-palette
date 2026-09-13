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
