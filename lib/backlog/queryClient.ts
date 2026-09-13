import { type Query, QueryClient } from '@tanstack/query-core';

/** 永続化したキャッシュを信じる上限。マスタの staleTime と同じ 1 日 */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 再試行は Query に任せない。429 はレート制御が待ち、401 は再接続の行になる（I6）。
 * 自動の再試行は search 枠を無駄に減らすだけ。
 */
export function createBacklogQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: PERSIST_MAX_AGE_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** 検索はセッション内のキャッシュ（palette.md §7.4）で、storage には書かない。成功した結果だけ残す */
export function shouldPersistQuery(query: Query): boolean {
  const [root, , kind] = query.queryKey;
  return root === 'backlog' && kind !== 'search' && query.state.status === 'success';
}
