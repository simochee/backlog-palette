import { panelLastSearch } from '@/lib/storage/panel-items';

import { takePanelRequest } from './handoff.ts';
import { canRun, fromSearchState, type PanelSearch, toSearchState } from './searchParams.ts';

/**
 * 開いたときに URL へ写す検索（surfaces.md §5.1）。パレットからの受け渡しが最優先で、
 * 次に URL が既に持っている検索、どちらも無ければ前回の検索を戻す。
 * 別のスペースの検索は戻さない。結果はタブのスペースの中だけに出す面なので（§5.2）
 *
 * 「URL が検索を持っている」は語ではなくスコープで判断する。受け渡しと復元はどちらも
 * スコープを書くので、写した後の 2 回目の判定で前回の検索が受け渡しを上書きしない
 */
export async function openingSearch(
  current: PanelSearch,
  tabSpace: string | undefined,
): Promise<PanelSearch | undefined> {
  const handedOff = await takePanelRequest();
  if (handedOff !== undefined) return handedOff;
  if (current.scope !== undefined) return undefined;
  const last = await panelLastSearch.getValue();
  if (last === null) return undefined;
  if (tabSpace !== undefined && last.scope.spaceId !== tabSpace) return undefined;
  return fromSearchState(last);
}

export function rememberSearch(search: PanelSearch): void {
  const state = toSearchState(search);
  if (state !== undefined && canRun(search)) void panelLastSearch.setValue(state);
}
