import type { DisplayCacheEntry } from '@/lib/storage/items';

/** 再取得の対象。表示キャッシュのうち API に安い単発取得の口がある課題だけ（D-14） */
export type StaleIssue = { spaceHost: string; issueKey: string };

/** 再取得で分かった今の件名。消えた課題（404）は summary を持たない */
export type FetchedIssue = { spaceHost: string; issueKey: string; summary?: string };

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

/**
 * 再取得の結果を写す。件名だけを更新し、visitedAt と並びは触らない（行の位置を動かさない、
 * I4 / D-14）。消えた課題は残す: 開けなくなった行を勝手に消すと「同じ入力 → 同じ結果」が
 * 破れる（P6）。消すのは履歴の消去か TTL の仕事
 */
export function applyRevalidated(
  entries: readonly DisplayCacheEntry[],
  fetched: readonly FetchedIssue[],
): { entries: DisplayCacheEntry[]; changed: number } {
  const summaries = new Map<string, string>();
  for (const issue of fetched)
    if (issue.summary !== undefined)
      summaries.set(`${issue.spaceHost}/${issue.issueKey}`, issue.summary);
  let changed = 0;
  const next = entries.map((entry) => {
    if (entry.kind !== 'issue' || entry.key === undefined) return entry;
    const summary = summaries.get(`${entry.spaceHost}/${entry.key}`);
    if (summary === undefined || summary === entry.title) return entry;
    changed += 1;
    return { ...entry, title: summary };
  });
  return { entries: changed === 0 ? [...entries] : next, changed };
}
