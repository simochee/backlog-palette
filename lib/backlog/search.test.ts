import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';

import type { IssueLike } from './entries';
import { type BacklogApi, createBacklogQueries } from './queries';
import { createSearchQueries, type SearchScope } from './search';

const HOST = 'demo.backlog.jp';
const space: SearchScope = { kind: 'space', spaceId: HOST };
const web: SearchScope = { kind: 'project', spaceId: HOST, projectId: 'PROJ' };
const PROJECTS = [
  { id: 101, projectKey: 'PROJ', name: 'Webリニューアル', useWiki: true },
  { id: 102, projectKey: 'MOB', name: 'モバイル', useWiki: true },
  { id: 103, projectKey: 'NOWIKI', name: 'Wiki 無し', useWiki: false },
];
const user = { id: 7, userId: 'me', name: '自分' };
const updated = '2026-09-10T00:00:00Z';

const ISSUES = [
  {
    projectId: 101,
    issueKey: 'PROJ-123',
    summary: 'ログイン画面のバリデーション修正',
    issueType: { name: 'バグ', color: '#990000' },
    status: { id: 1, name: '未対応' },
    updatedUser: user,
    updated,
  },
  {
    projectId: 101,
    issueKey: 'PROJ-142',
    summary: '決済フローのエラーハンドリング',
    issueType: { name: 'タスク', color: '#7ea800' },
    status: { id: 1, name: '未対応' },
    updatedUser: user,
    updated: '2026-09-11T00:00:00Z',
  },
];

function fakeApi() {
  return {
    getSpace: vi.fn(() => Promise.resolve({ spaceKey: 'demo', name: 'デモ' })),
    getMyself: vi.fn(() => Promise.resolve(user)),
    getProjects: vi.fn(() => Promise.resolve(PROJECTS)),
    getProjectStatuses: vi.fn(() =>
      Promise.resolve([
        { id: 1, name: '未対応', color: '#ed8077', displayOrder: 1 },
        { id: 4, name: '完了', color: '#b0be3c', displayOrder: 4 },
      ]),
    ),
    getIssues: vi.fn((): Promise<IssueLike[]> => Promise.resolve(ISSUES)),
    getWikis: vi.fn((params: { projectIdOrKey: string | number }) =>
      Promise.resolve([
        {
          id: Number(params.projectIdOrKey) * 10,
          projectId: Number(params.projectIdOrKey),
          name: `ログイン手順 ${params.projectIdOrKey}`,
          updatedUser: user,
          updated,
        },
      ]),
    ),
    getDocuments: vi.fn(() =>
      Promise.resolve([
        { id: 'doc-1', projectId: 102, title: '障害対応', updatedUser: user, updated },
      ]),
    ),
  } satisfies BacklogApi;
}

function setup() {
  const api = fakeApi();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queries = createBacklogQueries(() => Promise.resolve(api), queryClient);
  const search = createSearchQueries(() => Promise.resolve(api), queryClient, queries);
  return { api, queryClient, search };
}

describe('課題の検索', () => {
  it('スコープのプロジェクトと語で引き、件名に一致した行を先に並べられる形で返す', async () => {
    const { api, queryClient, search } = setup();

    const rows = await queryClient.query(search.issues('ログイン', web));

    expect(api.getIssues).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: [101], keyword: 'ログイン', count: 30 }),
    );
    expect(rows.map((row) => [row.key, row.titleMatched])).toEqual([
      ['PROJ-123', true],
      ['PROJ-142', false],
    ]);
    expect(rows[0]).toMatchObject({
      kind: 'issue',
      projectName: 'Webリニューアル',
      updatedAt: Date.parse(updated),
      url: 'https://demo.backlog.jp/view/PROJ-123',
    });
  });

  it('同じ語と範囲で再び引いても API を叩かない', async () => {
    const { api, queryClient, search } = setup();

    await queryClient.query(search.issues('ログイン', space));
    await queryClient.query(search.issues('ログイン', space));
    await queryClient.query(search.issues('ログイン', web));

    expect(api.getIssues).toHaveBeenCalledTimes(2);
  });

  it('パネルの条件は statusId・assigneeId に展開されて渡る', async () => {
    const { api, queryClient, search } = setup();

    await queryClient.query(
      search.issues('ログイン', space, {
        type: 'issue',
        status: { kind: 'notClosed' },
        assignee: 'me',
        updated: 'any',
      }),
    );

    expect(api.getIssues).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: [101, 102, 103], statusId: [1], assigneeId: [7] }),
    );
  });
});

describe('未割り当ての課題', () => {
  it('未割り当ての課題（assignee が null）が混ざっても、検索は失敗せず行を返す', async () => {
    const { api, queryClient, search } = setup();
    api.getIssues.mockResolvedValueOnce([
      ...ISSUES,
      {
        projectId: 101,
        issueKey: 'PROJ-150',
        summary: 'ログインの文言',
        issueType: { name: 'タスク', color: '#7ea800' },
        status: { id: 1, name: '未対応' },
        assignee: null,
        updatedUser: user,
        updated,
      },
    ]);

    const rows = await queryClient.query(search.issues('ログイン', web));

    expect(rows.map((row) => row.key)).toContain('PROJ-150');
  });
});

describe('Wiki とドキュメントの検索', () => {
  it('Wiki はスペース範囲では Wiki を使うプロジェクトごとに呼び、更新日時順に束ねる', async () => {
    const { api, queryClient, search } = setup();

    const rows = await queryClient.query(search.wikis('ログイン', space));

    expect(api.getWikis).toHaveBeenCalledTimes(2);
    expect(api.getWikis).toHaveBeenCalledWith({ projectIdOrKey: 101, keyword: 'ログイン' });
    expect(rows.map((row) => row.url)).toEqual([
      'https://demo.backlog.jp/alias/wiki/1010',
      'https://demo.backlog.jp/alias/wiki/1020',
    ]);
  });

  it('ドキュメントは横断で 1 回、offset 0 から引く', async () => {
    const { api, queryClient, search } = setup();

    const rows = await queryClient.query(search.documents('障害', space));

    expect(api.getDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: [101, 102, 103], keyword: '障害', offset: 0 }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'document',
        projectName: 'モバイル',
        titleMatched: true,
        url: 'https://demo.backlog.jp/document/MOB/doc-1',
      }),
    ]);
  });
});
