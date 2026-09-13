import { storage } from '#imports';

/**
 * Enterprise のカスタムドメイン（surfaces.md §8）。小文字のホスト名だけを入れる。
 * permissions.request と content script の動的登録は、この item を読む側
 * （lib/backlog/customDomains.ts）が行う。設定画面は一覧の表示と追加・削除の入口。
 */
export const customHosts = storage.defineItem<string[]>('local:customHosts', {
  fallback: [],
  version: 1,
});
