import { spaceHostOf } from '@/lib/backlog/host';
import { canonicalUrl, parsePath } from '@/lib/nav/path';
import type { DisplayCacheEntry, VisitedKind } from '@/lib/storage/items';

export type VisitedPage = Omit<DisplayCacheEntry, 'title' | 'visitedAt'>;

/**
 * 表示キャッシュに載せる対象と、その識別子（docs/backlog-facts.md §1）。
 * ページ定義（ボード・ガントなど）は載せない。そこは「{プロジェクト} のページ」が担当する。
 *
 * 別名 Wiki（`/alias/wiki/{id}`）の key は数字列の id。`lib/backlog/entries.ts` の
 * `wikiEntry` と行動ログが既にこの形なので、検索経由の頻度と合算される。名前指定の
 * Wiki は名前で記録され、API 無しでは別名と束ねられない（D-52）
 */
function identityOf(
  pathname: string,
  search: string,
): { kind: VisitedKind; projectKey?: string; key?: string } | undefined {
  const info = parsePath(pathname, search);
  if (info === undefined) return undefined;
  if (info.kind === 'issue')
    return { kind: 'issue', projectKey: info.projectKey, key: info.issueKey };
  if (info.kind === 'project') return { kind: 'project', projectKey: info.projectKey };
  if (info.kind === 'wiki') return { kind: 'wiki', projectKey: info.projectKey, key: info.name };
  if (info.kind === 'wikiAlias') return { kind: 'wiki', key: info.wikiId };
  if (info.kind === 'document')
    return { kind: 'document', projectKey: info.projectKey, key: info.documentId };
  // ページ定義（ボード・ガントなど）は表示キャッシュに載せない
  return undefined;
}

export function readVisitedPage(href: string): VisitedPage | undefined {
  const url = new URL(href);
  const spaceHost = spaceHostOf(url.origin);
  if (spaceHost === undefined) return undefined;

  const identity = identityOf(url.pathname, url.search);
  const canonical = canonicalUrl(href);
  if (identity === undefined || canonical === undefined) return undefined;

  return {
    url: canonical,
    kind: identity.kind,
    spaceHost,
    ...(identity.projectKey === undefined ? {} : { projectKey: identity.projectKey }),
    ...(identity.key === undefined ? {} : { key: identity.key }),
  };
}
