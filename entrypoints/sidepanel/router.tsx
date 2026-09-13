import { createHashHistory, createRouter } from '@tanstack/react-router';

import { PanelApp } from './PanelApp.tsx';
import { rootRoute } from './route.ts';

/*
 * 拡張ページの URL はサーバを持たないので hash history。Register には登録しない:
 * 設定画面の router が同じ Register を使っていて、拡張ページごとの router を
 * 1 つの宣言に載せられない。型は rootRoute.useSearch() から引く
 */
export const router = createRouter({
  routeTree: rootRoute.update({ component: PanelApp }),
  history: createHashHistory(),
});
