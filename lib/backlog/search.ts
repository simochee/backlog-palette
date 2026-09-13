import type { QueryClient } from '@tanstack/query-core';

import type { ResultRow } from '@/lib/search/types';
import type { SearchScope } from '@/lib/share';

import { mapWithConcurrency } from './concurrency';
import {
  documentEntry,
  type EntityKind,
  type Entry,
  issueEntry,
  type ProjectRef,
  wikiEntry,
} from './entries';
import { defaultConditions, planIssueSearch, type SearchConditions } from './filters';

/** 検索の範囲は lib/share の SearchScope（根を含まない、D-20）。行は lib/search の ResultRow */
export type { SearchScope };
export type SearchRow = ResultRow;
import type { BacklogQueries, BacklogQuery, ClientFor } from './queries';


/** 表示上限 30（palette.md §7.3）。それ以上は取らない */
export const SEARCH_COUNT = 30;
/** Wiki はプロジェクト単位。search 枠 150/分を意識して並列を絞る（backlog-facts.md §3.3） */
export const WIKI_CONCURRENCY = 3;

function titleMatches(title: string, query: string): boolean {
  return title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function toRow(entry: Entry, updated: string, query: string): SearchRow {
  const { spaceId: _host, projectId: _projectId, ...row } = entry;
  return { ...row, updatedAt: Date.parse(updated), titleMatched: titleMatches(entry.title, query) };
}

function byUpdatedDesc(a: SearchRow, b: SearchRow): number {
  return b.updatedAt - a.updatedAt;
}

const conditionsKey = (conditions: SearchConditions) => JSON.stringify(conditions);
const scopeKey = (scope: SearchScope) => (scope.kind === 'project' ? scope.projectId : '*');

export type SearchQueries = ReturnType<typeof createSearchQueries>;

type Env = {
  clientFor: ClientFor;
  queryClient: QueryClient;
  queries: BacklogQueries;
};

/* プロジェクトの id はキー（entrypoints/palette/context.ts の約束）。マスタから解決する */
async function projectsIn(env: Env, scope: SearchScope): Promise<ProjectRef[]> {
  const list = await env.queryClient.query(env.queries.projects(scope.spaceId));
  if (scope.kind === 'space') return list;
  return list.filter(
    (project) => project.projectKey === scope.projectId || String(project.id) === scope.projectId,
  );
}

function defineSearch<TData>(
  kind: EntityKind,
  query: string,
  scope: SearchScope,
  conditions: SearchConditions,
  queryFn: () => Promise<TData>,
): BacklogQuery<TData> {
  return {
    queryKey: [
      'backlog',
      scope.spaceId,
      'search',
      kind,
      scopeKey(scope),
      query,
      conditionsKey(conditions),
    ],
    queryFn,
    staleTime: Number.POSITIVE_INFINITY,
  };
}

async function searchIssues(
  env: Env,
  query: string,
  scope: SearchScope,
  conditions: SearchConditions,
): Promise<SearchRow[]> {
  const host = scope.spaceId;
  const list = await projectsIn(env, scope);
  if (list.length === 0) return [];
  const [me, statusesByProject] = await Promise.all([
    env.queryClient.query(env.queries.myself(host)),
    env.queries.statusesOf(host, list),
  ]);
  const plan = planIssueSearch(conditions, { statusesByProject, myselfId: me.id, now: Date.now() });
  const found = await (
    await env.clientFor(host)
  ).getIssues({
    ...plan.params,
    projectId: list.map((project) => project.id),
    keyword: query,
    sort: 'updated',
    order: 'desc',
    count: SEARCH_COUNT,
  });
  const byId = new Map(list.map((project) => [project.id, project]));
  return found
    .filter((issue) => plan.postFilter(issue))
    .flatMap((issue) => {
      const project = byId.get(issue.projectId);
      return project === undefined ? [] : [toRow(issueEntry(host, issue, project), issue.updated, query)];
    });
}

async function searchWikis(env: Env, query: string, scope: SearchScope): Promise<SearchRow[]> {
  const host = scope.spaceId;
  const list = (await projectsIn(env, scope)).filter((project) => project.useWiki);
  const client = await env.clientFor(host);
  const perProject = await mapWithConcurrency(list, WIKI_CONCURRENCY, async (project) => {
    const found = await client.getWikis({ projectIdOrKey: project.id, keyword: query });
    return found.map((wiki) => toRow(wikiEntry(host, wiki, project), wiki.updated, query));
  });
  return perProject.flat().toSorted(byUpdatedDesc).slice(0, SEARCH_COUNT);
}

async function searchDocuments(env: Env, query: string, scope: SearchScope): Promise<SearchRow[]> {
  const host = scope.spaceId;
  const list = await projectsIn(env, scope);
  if (list.length === 0) return [];
  const found = await (
    await env.clientFor(host)
  ).getDocuments({
    projectId: list.map((project) => project.id),
    keyword: query,
    offset: 0,
    count: SEARCH_COUNT,
    sort: 'updated',
    order: 'desc',
  });
  const byId = new Map(list.map((project) => [project.id, project]));
  return found.flatMap((document) => {
    const project = byId.get(document.projectId);
    return project === undefined
      ? []
      : [toRow(documentEntry(host, document, project), document.updated, query)];
  });
}

/**
 * 種別ごとに 1 クエリ。同じ語・範囲・条件なら同じキーなので、セッション内の再検索は
 * API を叩かない（palette.md §7.4）。staleTime は無限で、キャッシュの寿命は QueryClient の gcTime。
 * 状態・担当者・更新日の条件は課題にしか効かない（Wiki・ドキュメントに状態と担当者は無い）。
 */
export function createSearchQueries(
  clientFor: ClientFor,
  queryClient: QueryClient,
  queries: BacklogQueries,
) {
  const env: Env = { clientFor, queryClient, queries };
  return {
    issues: (query: string, scope: SearchScope, conditions = defaultConditions) =>
      defineSearch('issue', query, scope, conditions, () =>
        searchIssues(env, query, scope, conditions),
      ),
    wikis: (query: string, scope: SearchScope, conditions = defaultConditions) =>
      defineSearch('wiki', query, scope, conditions, () => searchWikis(env, query, scope)),
    documents: (query: string, scope: SearchScope, conditions = defaultConditions) =>
      defineSearch('document', query, scope, conditions, () => searchDocuments(env, query, scope)),
  };
}
