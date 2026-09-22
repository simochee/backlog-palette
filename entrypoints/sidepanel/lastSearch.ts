import { useEffect, useRef } from 'react';

import { panelLastSearch, panelRequest } from '@/lib/storage/panel-items';

import { canRun, fromSearchState, type PanelSearch, toSearchState } from './searchParams.ts';

/**
 * ツールバーから開いたとき、前回の検索を復元する（surfaces.md §5.1）。パレットからの
 * 受け渡しが待っているときと、URL が既に検索を持っているときはそちらが勝つ。
 * 別のスペースの検索は戻さない。結果はタブのスペースの中だけに出す面なので（§5.2）
 */
export function useRestoreLastSearch(
  current: PanelSearch,
  tabSpace: string | undefined,
  receive: (search: PanelSearch) => void,
) {
  const initial = useRef(current);
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      if (canRun(initial.current)) return;
      const [request, last] = await Promise.all([
        panelRequest.getValue(),
        panelLastSearch.getValue(),
      ]);
      if (!alive || request !== null || last === null) return;
      if (tabSpace !== undefined && last.scope.spaceId !== tabSpace) return;
      receive(fromSearchState(last));
    };
    void restore();
    return () => {
      alive = false;
    };
  }, [tabSpace, receive]);
}

export function useRememberSearch(search: PanelSearch) {
  useEffect(() => {
    const state = toSearchState(search);
    if (state !== undefined && canRun(search)) void panelLastSearch.setValue(state);
  }, [search]);
}
