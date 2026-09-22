import { useEffect, useEffectEvent } from 'react';

import { panelRequest } from '@/lib/storage/panel-items';

import { fromSearchState, type PanelSearch } from './searchParams.ts';

/**
 * パレットの `⌘→`・0 件の panel 行・条件つき共有 URL から渡された検索を受け取る
 * （surfaces.md §5.1）。読んだら消す: 面をまたぐ 1 回きりの受け渡しで、残すと次に
 * 開いたときにも復元されてしまう
 */
export async function takePanelRequest(): Promise<PanelSearch | undefined> {
  const request = await panelRequest.getValue();
  if (request === null) return undefined;
  await panelRequest.setValue(null);
  return fromSearchState(request.state);
}

/**
 * 開いている間に渡し直された検索を受ける。開いた時点の受け渡しは route の beforeLoad が
 * 先に取るが、そこから購読までの間に書かれた分を落とさないよう、購読の開始時にも 1 度読む
 */
export function useHandoff(receive: (search: PanelSearch) => void) {
  const onReceive = useEffectEvent(receive);
  useEffect(() => {
    let alive = true;
    const take = async () => {
      const search = await takePanelRequest();
      if (alive && search !== undefined) onReceive(search);
    };
    void take();
    const unwatch = panelRequest.watch((next) => {
      if (next !== null) void take();
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, []);
}
