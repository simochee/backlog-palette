import { storage } from '#imports';

/**
 * 設定画面で追加した Enterprise のカスタムドメイン（surfaces.md §8）。ホスト名だけを持つ。
 * permissions.request と content script の動的登録はこの一覧を読んで行う。
 * 接続の記録（spaces）とは別: 追加しただけで未接続のホストがありうる
 */
export const customHosts = storage.defineItem<string[]>('local:customHosts', {
  fallback: [],
  version: 1,
});
