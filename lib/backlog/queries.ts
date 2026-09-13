import type { QueryClient, QueryFunctionContext } from '@tanstack/query-core';
import type { Option } from 'backlog-js';

import {
  type DocumentLike,
  type Entry,
  type IssueLike,
  issueEntry,
  type ProjectRef,
  type WikiLike,
} from './entries';
import { expandNotClosed, unionStatusIds } from './statuses';

/** マスタは 1 日、担当課題は 5 分（tech-stack.md §3.1） */
export const MASTER_STALE_MS = 24 * 60 * 60 * 1000;
export const ASSIGNED_STALE_MS = 5 * 60 * 1000;
/** 空状態の「担当中の課題」は 5 件（palette.md §9） */
export const ASSIGNED_COUNT = 5;

export type StatusRecord = { id: number; name: string; color: string; displayOrder: number };

/**
 * backlog-js のうち Query 層が呼ぶメソッド。戻りは行に要る項目だけの構造型で受け、
 * Backlog クラスはこれを満たす。テストでは偽物を渡す。
 */
export type BacklogApi = {
  getSpace: () => Promise<{ spaceKey: string; name: string }>;
  getMyself: () => Promise<{ id: number; userId: string; name: string }>;
  getProjects: (params?: Option.Project.GetProjectsParams) => Promise<ProjectRef[]>;
  getProjectStatuses: (projectIdOrKey: string | number) => Promise<StatusRecord[]>;
  getIssues: (params?: Option.Issue.GetIssuesParams) => Promise<IssueLike[]>;
  getWikis: (params: Option.Wiki.GetWikiParams) => Promise<WikiLike[]>;
  getDocuments: (params: Option.Document.GetDocumentsParams) => Promise<DocumentLike[]>;
};

/** ホストからそのスペースのクライアントを得る。鍵が無ければ NotConnectedError */
export type ClientFor = (spaceHost: string) => Promise<BacklogApi>;

export type BacklogQueryKey = readonly ['backlog', string, ...(string | number)[]];

export type BacklogQuery<TData> = {
  queryKey: BacklogQueryKey;
  queryFn: (context: QueryFunctionContext<BacklogQueryKey>) => Promise<TData>;
  staleTime: number;
};

/*
 * react-query の queryOptions は lib/ からは使えない（React を知らない規約）。
 * 型を保ったまま素のオプションを返し、useQuery と queryClient.fetchQuery の両方に渡す。
 */
function defineQuery<TData>(query: BacklogQuery<TData>): BacklogQuery<TData> {
  return query;
}

export type BacklogQueries = ReturnType<typeof createBacklogQueries>;

/** マスタ（スペース・自分・プロジェクト・ステータス）。キーは ['backlog', host, ...] で始める（tech-stack.md §3.1） */
function createMasterQueries(clientFor: ClientFor) {
  const space = (host: string) =>
    defineQuery({
      queryKey: ['backlog', host, 'space'],
      queryFn: async () => {
        const { spaceKey, name } = await (await clientFor(host)).getSpace();
        return { spaceKey, name };
      },
      staleTime: MASTER_STALE_MS,
    });

  const myself = (host: string) =>
    defineQuery({
      queryKey: ['backlog', host, 'myself'],
      queryFn: async () => {
        const { id, userId, name } = await (await clientFor(host)).getMyself();
        return { id, userId, name };
      },
      staleTime: MASTER_STALE_MS,
    });

  const projects = (host: string) =>
    defineQuery<ProjectRef[]>({
      queryKey: ['backlog', host, 'projects'],
      queryFn: async () => {
        const list = await (await clientFor(host)).getProjects({ archived: false });
        return list.map(({ id, projectKey, name, useWiki }) => ({ id, projectKey, name, useWiki }));
      },
      staleTime: MASTER_STALE_MS,
    });

  const statuses = (host: string, projectId: number) =>
    defineQuery<StatusRecord[]>({
      queryKey: ['backlog', host, 'projects', projectId, 'statuses'],
      queryFn: async () => {
        const list = await (await clientFor(host)).getProjectStatuses(projectId);
        return list.map(({ id, name, color, displayOrder }) => ({ id, name, color, displayOrder }));
      },
      staleTime: MASTER_STALE_MS,
    });

  return { space, myself, projects, statuses };
}

/** Query のカタログ。マスタに、マスタを組み合わせて引く担当課題を足す */
export function createBacklogQueries(clientFor: ClientFor, queryClient: QueryClient) {
  const masters = createMasterQueries(clientFor);
  const { myself, projects, statuses } = masters;

  /** 参加プロジェクトすべてのステータス。プロジェクト ID をキーにした表 */
  const statusesOf = async (host: string, list: readonly ProjectRef[]) => {
    const lists = await Promise.all(
      list.map((project) => queryClient.query(statuses(host, project.id))),
    );
    return Object.fromEntries(list.map((project, i) => [String(project.id), lists[i] ?? []]));
  };

  /** 完了を除く担当課題。更新日時順に 5 件（palette.md §9） */
  const assignedIssues = (host: string) =>
    defineQuery<Entry[]>({
      queryKey: ['backlog', host, 'assigned'],
      queryFn: async () => {
        const [me, list] = await Promise.all([
          queryClient.query(myself(host)),
          queryClient.query(projects(host)),
        ]);
        if (list.length === 0) return [];
        const notClosed = unionStatusIds(expandNotClosed(await statusesOf(host, list)));
        const issues = await (
          await clientFor(host)
        ).getIssues({
          projectId: list.map((project) => project.id),
          assigneeId: [me.id],
          statusId: notClosed,
          sort: 'updated',
          order: 'desc',
          count: ASSIGNED_COUNT,
        });
        const byId = new Map(list.map((project) => [project.id, project]));
        return issues.flatMap((issue) => {
          const project = byId.get(issue.projectId);
          return project === undefined ? [] : [issueEntry(host, issue, project)];
        });
      },
      staleTime: ASSIGNED_STALE_MS,
    });

  return { ...masters, statusesOf, assignedIssues };
}
