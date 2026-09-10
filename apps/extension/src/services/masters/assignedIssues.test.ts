import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { type SpaceConnection, spacesItem } from '../../storage/schema.ts';
import { saveApiKey } from '../auth/credentials.ts';
import type { BacklogIssue, IssueSearchParams } from '../backlog/index.ts';
import { type BacklogClient, createClient } from '../backlog/index.ts';
import { ASSIGNED_ISSUES_TTL_MS, loadAssignedIssues } from './assignedIssues.ts';

vi.mock('../backlog/index.ts', () => ({ createClient: vi.fn() }));

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);
const MY_USER_ID = 99;
const OTHER_USER_ID = 7;

const PROJECTS = [
  {
    id: 10,
    projectKey: 'WEB',
    name: 'Webリニューアル',
    archived: false,
    displayOrder: 0,
    useWiki: true,
  },
  { id: 20, projectKey: 'OPS', name: '運用', archived: false, displayOrder: 1, useWiki: true },
];

const me = { id: MY_USER_ID, name: '田村' };
const other = { id: OTHER_USER_ID, name: '鈴木' };

function issue(keyId: number, status: { id: number; name: string }, updated: string): BacklogIssue {
  return {
    id: 1000 + keyId,
    projectId: 10,
    issueKey: `WEB-${keyId}`,
    keyId,
    summary: `課題 ${keyId}`,
    description: '',
    issueType: { id: 1, projectId: 10, name: 'タスク', color: '#7ea800' },
    status: { id: status.id, projectId: 10, name: status.name, color: '#4488c5', displayOrder: 0 },
    priority: { id: 3, name: '中' },
    assignee: me,
    createdUser: other,
    created: updated,
    updatedUser: me,
    updated,
  };
}

const OPEN_ISSUES = [
  issue(1, { id: 2, name: '処理中' }, '2026-09-10T11:00:00Z'),
  issue(2, { id: 1, name: '未対応' }, '2026-09-09T11:00:00Z'),
  issue(3, { id: 5, name: 'レビュー中' }, '2026-09-08T11:00:00Z'),
  issue(4, { id: 1, name: '未対応' }, '2026-09-07T11:00:00Z'),
  issue(5, { id: 2, name: '処理中' }, '2026-09-06T11:00:00Z'),
  issue(6, { id: 1, name: '未対応' }, '2026-09-05T11:00:00Z'),
];

let issues: Mock;
let projects: Mock;

beforeEach(async () => {
  fakeBrowser.reset();

  projects = vi.fn(async () => PROJECTS);
  issues = vi.fn(async () => OPEN_ISSUES);
  const get = vi.fn(async () => ({ id: MY_USER_ID }));
  const unused = () => Promise.reject(new Error('この経路は使わない'));

  const client: BacklogClient = {
    host: 'nulab.backlog.jp',
    spaceKey: 'nulab',
    get: get as unknown as BacklogClient['get'],
    projects,
    issues: issues as unknown as BacklogClient['issues'],
    wikis: unused,
    documents: unused,
    statuses: unused,
    rateLimit: unused,
  };

  vi.mocked(createClient).mockReturnValue(client);

  const connection: SpaceConnection = {
    spaceKey: 'nulab',
    host: 'nulab.backlog.jp',
    method: 'apiKey',
    displayName: 'nulab',
    state: 'connected',
  };
  await spacesItem.setValue([connection]);
  await saveApiKey('nulab', 'key-for-nulab');
});

function requestedParams(): IssueSearchParams {
  const [params] = issues.mock.calls[0] ?? [];
  return params as IssueSearchParams;
}

describe('担当中の課題', () => {
  it('マスタのプロジェクトを指定し、自分が担当のものだけを引く', async () => {
    await loadAssignedIssues('nulab', NOW);

    expect(requestedParams().projectId).toEqual([10, 20]);
    expect(requestedParams().assigneeId).toEqual([MY_USER_ID]);
  });

  it('更新の新しい順に並ぶよう API に並び順を指定する', async () => {
    await loadAssignedIssues('nulab', NOW);

    expect(requestedParams().sort).toBe('updated');
    expect(requestedParams().order).toBe('desc');
  });

  it('既定では上位 5 件だけ返す', async () => {
    const assigned = await loadAssignedIssues('nulab', NOW);

    expect(assigned.map((row) => row.issueKey)).toEqual([
      'WEB-1',
      'WEB-2',
      'WEB-3',
      'WEB-4',
      'WEB-5',
    ]);
  });

  it('件数を指定すればその件数まで返す', async () => {
    expect(await loadAssignedIssues('nulab', NOW, 2)).toHaveLength(2);
  });

  it('完了した課題は除く', async () => {
    issues.mockResolvedValue([
      issue(7, { id: 4, name: '完了' }, '2026-09-10T12:00:00Z'),
      ...OPEN_ISSUES,
    ]);

    const assigned = await loadAssignedIssues('nulab', NOW);

    expect(assigned.map((row) => row.issueKey)).not.toContain('WEB-7');
  });

  it('カスタムステータスの課題は未完了として残る', async () => {
    const assigned = await loadAssignedIssues('nulab', NOW);

    expect(assigned.map((row) => row.statusName)).toContain('レビュー中');
  });

  it('行に出すプロジェクト名はマスタから引く', async () => {
    const [first] = await loadAssignedIssues('nulab', NOW);

    expect(first?.projectName).toBe('Webリニューアル');
  });

  it('TTL 内は検索枠を使わずキャッシュを返す', async () => {
    const first = await loadAssignedIssues('nulab', NOW);
    const second = await loadAssignedIssues('nulab', NOW + ASSIGNED_ISSUES_TTL_MS - 1);

    expect(second).toEqual(first);
    expect(issues).toHaveBeenCalledTimes(1);
  });

  it('TTL を過ぎたら取り直す', async () => {
    await loadAssignedIssues('nulab', NOW);
    await loadAssignedIssues('nulab', NOW + ASSIGNED_ISSUES_TTL_MS);

    expect(issues).toHaveBeenCalledTimes(2);
  });

  it('取得に失敗しても空配列を返す', async () => {
    issues.mockRejectedValue(new Error('429'));

    await expect(loadAssignedIssues('nulab', NOW)).resolves.toEqual([]);
  });

  it('失敗のあとに復旧したら次の呼び出しで出る', async () => {
    issues.mockRejectedValueOnce(new Error('429'));

    expect(await loadAssignedIssues('nulab', NOW)).toEqual([]);
    expect(await loadAssignedIssues('nulab', NOW)).not.toEqual([]);
  });

  it('マスタが取れないスペースでは課題を引かない', async () => {
    projects.mockRejectedValue(new Error('401'));

    await expect(loadAssignedIssues('nulab', NOW)).resolves.toEqual([]);
    expect(issues).not.toHaveBeenCalled();
  });

  it('未接続のスペースでは課題を引かない', async () => {
    await expect(loadAssignedIssues('acme', NOW)).resolves.toEqual([]);
    expect(issues).not.toHaveBeenCalled();
  });
});
