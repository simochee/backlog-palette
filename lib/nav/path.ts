import { pages } from './pages';

/**
 * Backlog のパスが指すもの。表示キャッシュの記録（content script）と現在ページの種別
 * （遷移パターンの from）が同じ判定を使う。URL のホスト判定は lib/backlog/host.ts の持ち物
 */
export type PathInfo =
  | { kind: 'issue'; projectKey: string; issueKey: string }
  | { kind: 'project'; projectKey: string }
  | { kind: 'wiki'; projectKey: string; name: string }
  | { kind: 'wikiAlias'; wikiId: string }
  | { kind: 'document'; projectKey: string; documentId: string }
  | { kind: 'page'; pageId: string; projectKey?: string };

/*
 * 課題キーは文字種だけ緩く見て、実在キーとの突き合わせで確定させる（backlog-facts.md §2.2）。
 * 表示・遷移には大文字化した正規形を使う。Wiki の名前とドキュメント ID は大文字小文字を区別する
 * 値なので変えない
 */
const ISSUE = /^\/view\/(?<key>(?<project>[A-Za-z][A-Za-z0-9_]*)-\d+)\/?$/u;
const WIKI_PAGE = /^\/wiki\/(?<project>[A-Z][A-Z0-9_]*)\/(?<name>.+)$/u;
const WIKI_ALIAS = /^\/alias\/wiki\/(?<id>\d+)\/?$/u;
const DOCUMENT = /^\/document\/(?<project>[A-Z][A-Z0-9_]*)\/(?<id>[^/]+)\/?$/u;

function group(match: RegExpExecArray, name: string): string | undefined {
  return match.groups?.[name];
}

function entityOf(pathname: string): PathInfo | undefined {
  const issue = ISSUE.exec(pathname);
  const issueKey = issue === null ? undefined : group(issue, 'key');
  const issueProject = issue === null ? undefined : group(issue, 'project');
  if (issueKey !== undefined && issueProject !== undefined)
    return {
      kind: 'issue',
      projectKey: issueProject.toUpperCase(),
      issueKey: issueKey.toUpperCase(),
    };

  const wiki = WIKI_PAGE.exec(pathname);
  const wikiProject = wiki === null ? undefined : group(wiki, 'project');
  const wikiName = wiki === null ? undefined : group(wiki, 'name');
  if (wikiProject !== undefined && wikiName !== undefined)
    return { kind: 'wiki', projectKey: wikiProject, name: decodeURIComponent(wikiName) };

  const alias = WIKI_ALIAS.exec(pathname);
  const wikiId = alias === null ? undefined : group(alias, 'id');
  if (wikiId !== undefined) return { kind: 'wikiAlias', wikiId };

  const document = DOCUMENT.exec(pathname);
  const documentProject = document === null ? undefined : group(document, 'project');
  const documentId = document === null ? undefined : group(document, 'id');
  if (documentProject !== undefined && documentId !== undefined)
    return { kind: 'document', projectKey: documentProject, documentId };
  return undefined;
}

function pageOf(pathname: string, search: string): PathInfo | undefined {
  for (const page of pages) {
    for (const pattern of page.paths) {
      const match = pattern.exec(pathname);
      if (match === null) continue;
      // パスに識別子が無い画面（プロジェクト設定）はクエリが識別子。落とすと別の画面と同じになる
      const fromQuery =
        page.identityQuery === undefined
          ? undefined
          : (new URLSearchParams(search).get(page.identityQuery) ?? undefined);
      const projectKey = group(match, 'projectKey') ?? fromQuery;
      if (page.id === 'project-home' && projectKey !== undefined)
        return { kind: 'project', projectKey };
      return projectKey === undefined
        ? { kind: 'page', pageId: page.id }
        : { kind: 'page', pageId: page.id, projectKey };
    }
  }
  return undefined;
}

/** パス（`location.pathname`）を見る。ホストがスペースかどうかは呼び出し側が先に判定する */
export function parsePath(pathname: string, search = ''): PathInfo | undefined {
  return entityOf(pathname) ?? pageOf(pathname, search);
}

/**
 * パスの同一性。同じページを指す URL は同じ文字列になる（末尾のスラッシュ・課題キーの
 * 大文字小文字・別名パス・表示状態のクエリを畳む）。解釈できないパスは undefined。
 *
 * 文字列を置換して回るのではなく、`parsePath` で同一性まで落としてから組み直す。
 * 「何を畳んで何を畳まないか」が PathInfo に何を残すかで決まり、抜けが型で見える
 */
export function canonicalPath(pathname: string, search = ''): string | undefined {
  const info = parsePath(pathname, search);
  if (info === undefined) return undefined;
  if (info.kind === 'issue') return `/view/${info.issueKey}`;
  if (info.kind === 'project') return `/projects/${info.projectKey}`;
  // Wiki の名前は大文字小文字も末尾のスラッシュも区別する値。デコードして組み直すと
  // 階層の `/` が `%2F` になって別ページになるので、ブラウザが正規化した原文をそのまま使う
  if (info.kind === 'wiki') return pathname;
  if (info.kind === 'wikiAlias') return `/alias/wiki/${info.wikiId}`;
  if (info.kind === 'document') return `/document/${info.projectKey}/${info.documentId}`;
  return pages
    .find((page) => page.id === info.pageId)
    ?.build({ origin: '', projectKey: info.projectKey });
}

/**
 * URL の同一性。href で受けるのは、content script が `location.href` を、
 * 拡張ページが `tab.url` を持つため。フラグメントは `URL` が pathname から外す
 */
export function canonicalUrl(href: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  const path = canonicalPath(url.pathname, url.search);
  return path === undefined ? undefined : url.origin + path;
}

/** 現在ページの種別。遷移パターン（D-16）の from に使う */
export function pageKindOf(pathname: string): string | undefined {
  const info = parsePath(pathname);
  if (info === undefined) return undefined;
  return info.kind === 'page' ? info.pageId : info.kind;
}

export function projectKeyOf(pathname: string): string | undefined {
  const info = parsePath(pathname);
  return info !== undefined && 'projectKey' in info ? info.projectKey : undefined;
}
