import { createRootRoute } from '@tanstack/react-router';

import { panelSearchSchema } from './searchParams.ts';

/*
 * パネルは 1 ルート。検索状態（語・スコープ・条件）を zod で検証した search params として持ち、
 * `#bl-search` の codec と同じスキーマを使う（tech-stack.md §3.4）。
 * component は router.tsx で付ける。ここで付けると container との循環 import になる
 */
export const rootRoute = createRootRoute({
  validateSearch: (raw) => panelSearchSchema.parse(raw),
});
