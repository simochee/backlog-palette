import { spaceKeyOf } from '@/lib/backlog/host';
import type { DisplayCacheEntry, VisitedKind } from '@/lib/storage/items';

type PagePattern = {
  kind: VisitedKind;
  pattern: RegExp;
  /** パスから読んだ生の値を保存する形に直す。無ければ key を持たない画面 */
  readKey?: (raw: string) => string;
};

/*
 * 表示キャッシュに載せる画面だけを拾う（docs/backlog-facts.md §1）。
 * 課題キーは実在キーと突き合わせるまで文字種だけで緩く見る（同 §2.2）。
 *
 * 大文字化するのは課題キーだけ。Wiki のページ名とドキュメント ID は
 * 大文字小文字を区別する値で、変えると URL を組み直したときに別ページになる。
 */
const PAGES: readonly PagePattern[] = [
  {
    kind: 'issue',
    pattern: /^\/view\/(?<key>(?<project>[A-Za-z][A-Za-z0-9_]*)-\d+)$/u,
    readKey: (raw) => raw.toUpperCase(),
  },
  { kind: 'project', pattern: /^\/projects\/(?<project>[A-Z][A-Z0-9_]*)$/u },
  {
    kind: 'wiki',
    pattern: /^\/wiki\/(?<project>[A-Z][A-Z0-9_]*)\/(?<key>.+)$/u,
    // pathname はパーセントエンコードされている。名前として保存する
    readKey: (raw) => decodeURIComponent(raw),
  },
  {
    kind: 'document',
    pattern: /^\/document\/(?<project>[A-Z][A-Z0-9_]*)\/(?<key>[^/]+)$/u,
    readKey: (raw) => raw,
  },
];

export type VisitedPage = Omit<DisplayCacheEntry, 'title' | 'visitedAt'>;

export function readVisitedPage(href: string): VisitedPage | undefined {
  const url = new URL(href);
  const spaceKey = spaceKeyOf(url.origin);
  if (spaceKey === undefined) return undefined;

  for (const { kind, pattern, readKey } of PAGES) {
    const match = pattern.exec(url.pathname);
    const projectKey = match?.groups?.project;
    if (match === null || projectKey === undefined) continue;
    const raw = match.groups?.key;
    return {
      url: url.origin + url.pathname,
      kind,
      spaceKey,
      projectKey: projectKey.toUpperCase(),
      ...(readKey === undefined || raw === undefined ? {} : { key: readKey(raw) }),
    };
  }
  return undefined;
}
