import { spaceKeyOf } from '@/lib/backlog/host';
import type { DisplayCacheEntry, VisitedKind } from '@/lib/storage/items';

/*
 * 表示キャッシュに載せる画面だけを拾う（docs/backlog-facts.md §1）。
 * 課題キーは実在キーと突き合わせるまで文字種だけで緩く見る（同 §2.2）。
 */
const PATTERNS: readonly [VisitedKind, RegExp][] = [
  ['issue', /^\/view\/((?<project>[A-Za-z][A-Za-z0-9_]*)-\d+)$/u],
  ['project', /^\/projects\/(?<project>[A-Z][A-Z0-9_]*)$/u],
  ['wiki', /^\/wiki\/(?<project>[A-Z][A-Z0-9_]*)\/(.+)$/u],
  ['document', /^\/document\/(?<project>[A-Z][A-Z0-9_]*)\/([^/]+)$/u],
];

export type VisitedPage = Omit<DisplayCacheEntry, 'title' | 'visitedAt'>;

export function readVisitedPage(href: string): VisitedPage | undefined {
  const url = new URL(href);
  const spaceKey = spaceKeyOf(url.origin);
  if (spaceKey === undefined) return undefined;

  for (const [kind, pattern] of PATTERNS) {
    const match = pattern.exec(url.pathname);
    const projectKey = match?.groups?.project;
    if (match === null || projectKey === undefined) continue;
    const key = match[1];
    return {
      url: url.origin + url.pathname,
      kind,
      spaceKey,
      projectKey: projectKey.toUpperCase(),
      ...(kind === 'project' || key === undefined ? {} : { key: key.toUpperCase() }),
    };
  }
  return undefined;
}
