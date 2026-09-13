import { clientFor } from '@/lib/backlog/clients';
import type { PaletteIndex } from '@/lib/palette';
import { displayCache } from '@/lib/storage/items';
import { refreshShownIssues } from '@/lib/visits/refresh';

import { backlog } from './backlog.ts';

const noop = () => {};

/*
 * stale-while-revalidate（D-14）。開いた直後はキャッシュで描き、表示する行の課題は後から
 * 引き直して次に開いたときの表示に反映する。今描いている行は動かさない。
 * 未接続なら何もしない（鍵が無い）。失敗は表示の鮮度の話なので握る
 */
export function revalidateInBackground(index: PaletteIndex, spaceHost: string, connected: boolean) {
  if (!connected) return;
  const shown = new Set(
    index.cache.filter((entry) => entry.spaceId === spaceHost).map((entry) => entry.url),
  );
  void displayCache
    .getValue()
    .then((entries) =>
      refreshShownIssues(entries, shown, { queryClient: backlog.queryClient, clientFor }),
    )
    .catch(noop);
}
