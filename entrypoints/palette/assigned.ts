import { createStore } from '@tanstack/store';

import { toApiFailure } from '@/lib/backlog/failure';
import type { AssignedState } from '@/lib/palette';
import type { Readable } from '@/lib/store';

import { backlog } from './backlog.ts';

/*
 * 失敗しても空状態は描く。失敗は担当課題のセクションの中の行になる（I6・D-38）。
 * 分類を捨てて undefined を返すと、取れなかったときに「読み込み中」が回り続ける
 */
async function assignedFor(host: string, connected: boolean): Promise<AssignedState> {
  // 未接続のスペースでは空状態が接続行になり、担当課題のセクションは出ない（§9）
  if (!connected) return { kind: 'ready', rows: [] };
  try {
    const rows = await backlog.queryClient.query(backlog.queries.assignedIssues(host));
    return { kind: 'ready', rows };
  } catch (error) {
    return { kind: 'failed', error: toApiFailure(error) };
  }
}

/** 取得は用意の時点で始め、届いたら Store を更新する。読み込み中は loading */
export function assignedStoreFor(host: string, connected: boolean): Readable<AssignedState> {
  const store = createStore<AssignedState>({ kind: 'loading' });
  void assignedFor(host, connected).then((state) => store.setState(() => state));
  return store;
}
