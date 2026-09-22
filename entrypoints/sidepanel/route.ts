import { createRootRoute, redirect } from '@tanstack/react-router';

import { readPanelContextOnce } from './context.ts';
import { openingSearch } from './lastSearch.ts';
import { panelSearchSchema } from './searchParams.ts';

/*
 * パネルは 1 ルート。検索状態（語・スコープ・条件）を zod で検証した search params として持ち、
 * `#bl-search` の codec と同じスキーマを使う（tech-stack.md §3.4）。
 * component は router.tsx で付ける。ここで付けると container との循環 import になる
 */
export const rootRoute = createRootRoute({
  validateSearch: (raw) => panelSearchSchema.parse(raw),
  beforeLoad: async ({ search, cause }) => {
    if (cause !== 'enter') return;
    const { tabSpace } = await readPanelContextOnce();
    const opening = await openingSearch(search, tabSpace);
    // TanStack Router の redirect は Response を投げて遷移させる設計。Error ではない
    // oxlint-disable-next-line typescript/only-throw-error
    if (opening !== undefined) throw redirect({ to: '/', search: opening, replace: true });
  },
});
