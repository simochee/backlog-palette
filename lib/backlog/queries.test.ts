import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';

import { type BacklogApi, createBacklogQueries } from './queries';
import { shouldPersistQuery } from './queryClient';

const HOST = 'demo.backlog.jp';
const user = (id: number, name: string) => ({ id, userId: `u${id}`, name });
const PROJECTS = [
  { id: 101, projectKey: 'PROJ', name: 'Webリニューアル', useWiki: true },
  { id: 102, projectKey: 'MOB', name: 'モバイル', useWiki: false },
];
const status = (id: number, name: string) => ({ id, name, color: '#393939', displayOrder: id });
const STATUSES: Record<number, ReturnType<typeof status>[]> = {
  101: [status(1, '未対応'), status(4, '完了'), status(10101, 'レビュー待ち')],
  102: [status(1, '未対応'), status(4, '完了')],
};
const updated = '2026-09-10T00:00:00Z';

function fakeApi() {
  const api = {
    getSpace: vi.fn(() => Promise.resolve({ spaceKey: 'demo', name: 'デモ' })),
    getMyself: vi.fn(() => Promise.resolve(user(7, '自分'))),
    getProjects: vi.fn(() => Promise.resolve(PROJECTS)),
    getProjectStatuses: vi.fn((id: string | number) => Promise.resolve(STATUSES[Number(id)] ?? [])),
    getIssues: vi.fn(() =>
      Promise.resolve([
        {
          projectId: 101,
          issueKey: 'PROJ-9',
          summary: '直近の課題',
          issueType: { name: 'タスク', color: '#7ea800' },
          status: { id: 1, name: '未対応' },
          assignee: user(7, '自分'),
          updatedUser: user(2, '誰か'),
          updated,
        },
        {
          projectId: 999,
          issueKey: 'GONE-1',
          summary: '参加していないプロジェクトの課題',
          issueType: { name: 'タスク', color: '#7ea800' },
          status: { id: 1, name: '未対応' },
          updatedUser: user(2, '誰か'),
          updated,
        },
      ]),
    ),
    getWikis: vi.fn(() => Promise.resolve([])),
    getDocuments: vi.fn(() => Promise.resolve([])),
  } satisfies BacklogApi;
  return api;
}

function setup() {
  const api = fakeApi();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queries = createBacklogQueries(() => Promise.resolve(api), queryClient);
  return { api, queryClient, queries };
}

describe('担当課題', () => {
  it('参加プロジェクト・自分の ID・完了を除く statusId で引き、更新日時順の 5 件を行の形で返す', async () => {
    const { api, queryClient, queries } = setup();

    const rows = await queryClient.query(queries.assignedIssues(HOST));

    expect(api.getIssues).toHaveBeenCalledWith({
      projectId: [101, 102],
      assigneeId: [7],
      statusId: [1, 10101],
      sort: 'updated',
      order: 'desc',
      count: 5,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'issue',
        key: 'PROJ-9',
        projectName: 'Webリニューアル',
        spaceId: HOST,
        url: 'https://demo.backlog.jp/view/PROJ-9',
      }),
    ]);
  });

  it('マスタは 1 度引けば再び API を叩かず、担当課題の 2 回目もキャッシュから返る', async () => {
    const { api, queryClient, queries } = setup();

    await queryClient.query(queries.assignedIssues(HOST));
    await queryClient.query(queries.assignedIssues(HOST));
    await queryClient.query(queries.projects(HOST));

    expect(api.getProjects).toHaveBeenCalledTimes(1);
    expect(api.getProjectStatuses).toHaveBeenCalledTimes(2);
    expect(api.getIssues).toHaveBeenCalledTimes(1);
  });
});

describe('キャッシュの寿命', () => {
  it('マスタは 24 時間、担当課題は 5 分、キーは backlog とホストで始まる', () => {
    const { queries } = setup();

    expect(queries.projects(HOST)).toMatchObject({
      queryKey: ['backlog', HOST, 'projects'],
      staleTime: 24 * 60 * 60 * 1000,
    });
    expect(queries.statuses(HOST, 101).queryKey).toEqual(['backlog', HOST, 'projects', 101, 'statuses']);
    expect(queries.assignedIssues(HOST).staleTime).toBe(5 * 60 * 1000);
  });

  it('検索と失敗した結果は storage に永続化しない', async () => {
    const { queryClient, queries } = setup();
    await queryClient.query(queries.projects(HOST));
    await queryClient
      .query({
        queryKey: ['backlog', HOST, 'search', 'issue', 'ログイン'],
        queryFn: () => Promise.resolve([]),
      })
      .catch(() => null);
    await queryClient
      .query({
        queryKey: ['backlog', HOST, 'space'],
        queryFn: () => Promise.reject(new Error('down')),
        retry: false,
      })
      .catch(() => null);

    const persisted = queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => shouldPersistQuery(query))
      .map((query) => query.queryKey);
    expect(persisted).toEqual([['backlog', HOST, 'projects']]);
  });
});
