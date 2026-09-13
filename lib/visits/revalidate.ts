import type { DisplayCacheEntry } from '@/lib/storage/items';

/** 再取得の対象。表示キャッシュのうち API に安い単発取得の口がある課題だけ（D-14） */
export type StaleIssue = { spaceHost: string; issueKey: string };

/** 再取得で分かった今の姿 */
export type IssueSnapshot = {
  summary: string;
  status: { id: number; name: string };
  assignee?: string;
};

/** 消えた課題（404）や引けなかった課題は current を持たない */
export type FetchedIssue = { spaceHost: string; issueKey: string; current?: IssueSnapshot };

export const REVALIDATE_BATCH = 20;

/**
 * 表示した行のうち再取得する課題を選ぶ。表示した順（= 表示キャッシュの並び）を保ち、
 * 1 回に投げる数を絞る。Read 枠は 600/分だが、開くたびに全部を引き直す理由は無い
 */
export function staleIssues(
  entries: readonly DisplayCacheEntry[],
  shownUrls: ReadonlySet<string>,
  limit = REVALIDATE_BATCH,
): StaleIssue[] {
  const picked: StaleIssue[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== 'issue' || entry.key === undefined || !shownUrls.has(entry.url)) continue;
    const id = `${entry.spaceHost}/${entry.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    picked.push({ spaceHost: entry.spaceHost, issueKey: entry.key });
    if (picked.length === limit) break;
  }
  return picked;
}

function same(entry: DisplayCacheEntry, current: IssueSnapshot): boolean {
  return (
    entry.title === current.summary &&
    entry.status?.id === current.status.id &&
    entry.status.name === current.status.name &&
    entry.assignee === current.assignee
  );
}

/**
 * 再取得の結果を写す。件名・ステータス・担当者だけを更新し、visitedAt と並びは触らない
 * （行の位置を動かさない、I4 / D-14）。消えた課題は残す: 開けなくなった行を勝手に消すと
 * 「同じ入力 → 同じ結果」が破れる（P6）。消すのは履歴の消去か TTL の仕事
 */
export function applyRevalidated(
  entries: readonly DisplayCacheEntry[],
  fetched: readonly FetchedIssue[],
): { entries: DisplayCacheEntry[]; changed: number } {
  const snapshots = new Map<string, IssueSnapshot>();
  for (const issue of fetched)
    if (issue.current !== undefined)
      snapshots.set(`${issue.spaceHost}/${issue.issueKey}`, issue.current);
  let changed = 0;
  const next = entries.map((entry) => {
    if (entry.kind !== 'issue' || entry.key === undefined) return entry;
    const current = snapshots.get(`${entry.spaceHost}/${entry.key}`);
    if (current === undefined || same(entry, current)) return entry;
    changed += 1;
    return {
      ...entry,
      title: current.summary,
      status: current.status,
      ...(current.assignee === undefined ? {} : { assignee: current.assignee }),
    };
  });
  return { entries: changed === 0 ? [...entries] : next, changed };
}
