import { useEffect } from 'react';

import type { SearchState } from '@/lib/share';
import { panelRequest } from '@/lib/storage/panel-items';

import { fromSearchState, type PanelSearch } from './searchParams.ts';

type Receive = (search: PanelSearch) => void;

/**
 * パレットの `⌘→`・0 件の panel 行・条件つき共有 URL から渡された検索を受け取る
 * （surfaces.md §5.1）。読んだら消す: 面をまたぐ 1 回きりの受け渡しで、残すと次に
 * 開いたときにも復元されてしまう。開いている間に渡し直されたときは watch で受ける
 */
export function useHandoff(receive: Receive) {
  useEffect(() => {
    let alive = true;
    const take = async (request: { state: SearchState; at: number } | null) => {
      if (request === null || !alive) return;
      await panelRequest.setValue(null);
      receive(fromSearchState(request.state));
    };
    void panelRequest.getValue().then(take);
    const unwatch = panelRequest.watch((next) => {
      void take(next);
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, [receive]);
}
