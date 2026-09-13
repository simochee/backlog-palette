import type { QueryClient } from '@tanstack/query-core';

import type { SpaceClient } from '@/lib/backlog/client';
import { type DisplayCacheEntry, displayCache } from '@/lib/storage/items';

import {
  applyRevalidated,
  type FetchedIssue,
  type IssueSnapshot,
  type StaleIssue,
  staleIssues,
} from './revalidate';

/** 表示した課題を引き直す間隔。開くたびに引き直す理由は無く、担当課題の 5 分と揃える */
export const REVALIDATE_STALE_MS = 5 * 60 * 1000;

export type RefreshDeps = {
  queryClient: QueryClient;
  clientFor: (spaceHost: string) => Promise<SpaceClient>;
};

type IssueResponse = {
  summary: string;
  status: { id: number; name: string };
  assignee?: { name: string } | null;
};

function snapshotOf(issue: IssueResponse): IssueSnapshot {
  return {
    summary: issue.summary,
    status: { id: issue.status.id, name: issue.status.name },
    ...(issue.assignee === undefined || issue.assignee === null
      ? {}
      : { assignee: issue.assignee.name }),
  };
}

/*
 * 消えた課題（404）や権限の無い課題は current 無しで返し、行は残す（revalidate.ts）。
 * 未接続・401 も同じ扱い: 再検証は表示の鮮度の話で、失敗を面に出す責務は検索の行にある（I6）
 */
async function fetchIssue(stale: StaleIssue, deps: RefreshDeps): Promise<FetchedIssue> {
  try {
    const current = await deps.queryClient.query({
      queryKey: ['backlog', stale.spaceHost, 'issue', stale.issueKey],
      queryFn: async () =>
        snapshotOf(await (await deps.clientFor(stale.spaceHost)).getIssue(stale.issueKey)),
      staleTime: REVALIDATE_STALE_MS,
    });
    return { ...stale, current };
  } catch {
    return stale;
  }
}

/**
 * stale-while-revalidate（D-14）。表示した行の課題を引き直し、件名・ステータス・担当者が
 * 変わっていれば表示キャッシュに写す。行の位置は動かさない。次に開いたときに反映される
 */
export async function refreshShownIssues(
  entries: readonly DisplayCacheEntry[],
  shownUrls: ReadonlySet<string>,
  deps: RefreshDeps,
): Promise<number> {
  const stale = staleIssues(entries, shownUrls);
  if (stale.length === 0) return 0;
  const fetched = await Promise.all(stale.map((issue) => fetchIssue(issue, deps)));
  // 引いている間に content script が書いた訪問を消さないよう、写す直前の値に重ねる
  const latest = await displayCache.getValue();
  const { entries: next, changed } = applyRevalidated(latest, fetched);
  if (changed > 0) await displayCache.setValue(next);
  return changed;
}
