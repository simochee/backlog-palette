import { panelLastSearch } from '@/lib/storage/panel-items';

import { takePanelRequest } from './handoff.ts';
import { canRun, fromSearchState, type PanelSearch, toSearchState } from './searchParams.ts';

export function rememberSearch(search: PanelSearch): void {
  const state = toSearchState(search);
  if (state !== undefined && canRun(search)) void panelLastSearch.setValue(state);
}

/**
 * 開いたときに URL へ写す検索（surfaces.md §5.1）。パレットからの受け渡しが最優先で、
 * 次に URL が既に持っている検索、どちらも無ければ前回の検索を戻す。
 * 別のスペースの検索は戻さない。結果はタブのスペースの中だけに出す面なので（§5.2）
 */
export async function openingSearch(
  current: PanelSearch,
  tabSpace: string | undefined,
): Promise<PanelSearch | undefined> {
  const handedOff = await takePanelRequest();
  if (handedOff !== undefined) {
    // URL を変える操作（update）を通らないので、ここで記憶しないと次に開いたとき戻らない
    rememberSearch(handedOff);
    return handedOff;
  }
  if (canRun(current)) return undefined;
  const last = await panelLastSearch.getValue();
  if (last === null) return undefined;
  if (tabSpace !== undefined && last.scope.spaceId !== tabSpace) return undefined;
  return fromSearchState(last);
}
