import type { PageEntry, PaletteIndex } from '@/lib/palette/model';
import type { Scope } from '@/lib/stack/types';

import { type PageContext, type PageScope, pagesFor } from './pages';

export type Language = 'ja' | 'en';

/** 索引を組むのに要る解決。スペースのオリジンとプロジェクトキーは container のマスタから引く */
export type NavResolver = {
  originOf: (spaceId: string) => string | undefined;
  projectKeyOf: (projectId: string) => string | undefined;
  language: Language;
};

export function pageEntriesFor(
  scope: PageScope,
  context: PageContext,
  language: Language,
): PageEntry[] {
  return pagesFor(scope, context).flatMap((page) => {
    const url = page.build(context);
    return url === undefined
      ? []
      : [{ id: page.id, title: page.title[language], aliases: page.aliases, kind: page.id, url }];
  });
}

function contextOf(resolver: NavResolver, scope: Scope): PageContext | undefined {
  if (scope.kind === 'root') return undefined;
  const origin = resolver.originOf(scope.spaceId);
  if (origin === undefined) return undefined;
  if (scope.kind === 'space') return { origin };
  const projectKey = resolver.projectKeyOf(scope.projectId);
  return projectKey === undefined ? undefined : { origin, projectKey };
}

export function issueUrl(origin: string, issueKey: string): string {
  return `${origin}/view/${issueKey}`;
}

/**
 * 本体の課題検索へ逃がす URL。全体検索と課題一覧に語を渡すパラメータ名は台帳で未確認なので
 * （backlog-facts.md §1.2、mvp-evaluation §5）、語は付けずにページだけ開く
 */
export function externalSearchUrl(context: PageContext): string {
  return context.projectKey === undefined
    ? `${context.origin}/FindIssueAllOver.action`
    : `${context.origin}/find/${context.projectKey}`;
}

/** PaletteIndex のうち URL とページ定義に関わる 3 つを組む。残り（キャッシュ・行動ログ）は container が足す */
export function navIndex(
  resolver: NavResolver,
): Pick<PaletteIndex, 'pagesFor' | 'issueUrl' | 'externalSearchUrl'> {
  return {
    // [space / project] でもダッシュボードや全体検索は URL が組めるので候補に出す（§4）。
    // 並びは project → space。見出しは §9 の「{プロジェクト} のページ」のまま
    pagesFor: (scope) => {
      if (scope.kind === 'root') return [];
      const context = contextOf(resolver, scope);
      if (context === undefined) return [];
      const own = pageEntriesFor(scope.kind, context, resolver.language);
      return scope.kind === 'project'
        ? [...own, ...pageEntriesFor('space', context, resolver.language)]
        : own;
    },
    issueUrl: (spaceId, key) => issueUrl(resolver.originOf(spaceId) ?? '', key),
    // 根では検索しない（D-20）ので、スコープが解決できないときの値は使われない
    externalSearchUrl: (scope) => {
      const context = contextOf(resolver, scope);
      return context === undefined ? '' : externalSearchUrl(context);
    },
  };
}
