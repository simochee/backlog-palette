import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { type SpaceConnection, spacesItem } from '../../storage/schema.ts';
import { saveApiKey } from '../auth/credentials.ts';
import { type BacklogClient, createClient } from '../backlog/index.ts';
import {
  invalidateMasters,
  loadAllMasters,
  loadMasters,
  loadProjectStatuses,
  MASTERS_TTL_MS,
} from './masters.ts';

vi.mock('../backlog/index.ts', () => ({ createClient: vi.fn() }));

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);
const MY_USER_ID = 99;

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

const STATUSES = [
  { id: 1, projectId: 10, name: '未対応', color: '#ed8077', displayOrder: 1000 },
  { id: 2, projectId: 10, name: '処理中', color: '#4488c5', displayOrder: 2000 },
];

type SpaceStub = {
  readonly client: BacklogClient;
  readonly projects: Mock;
  readonly get: Mock;
  readonly statuses: Mock;
};

function stubSpace(spaceKey: string): SpaceStub {
  const projects = vi.fn(async () => PROJECTS);
  const get = vi.fn(async () => ({ id: MY_USER_ID }));
  const statuses = vi.fn(async () => STATUSES);
  const unused = () => Promise.reject(new Error('この経路は使わない'));

  return {
    projects,
    get,
    statuses,
    client: {
      host: `${spaceKey}.backlog.jp`,
      spaceKey,
      get: get as unknown as BacklogClient['get'],
      projects,
      issues: unused,
      wikis: unused,
      documents: unused,
      statuses,
      rateLimit: unused,
    },
  };
}

const stubs = new Map<string, SpaceStub>();

async function connect(spaceKey: string): Promise<void> {
  const connection: SpaceConnection = {
    spaceKey,
    host: `${spaceKey}.backlog.jp`,
    method: 'apiKey',
    displayName: spaceKey,
    state: 'connected',
  };

  await spacesItem.setValue([...(await spacesItem.getValue()), connection]);
  await saveApiKey(spaceKey, `key-for-${spaceKey}`);

  stubs.set(spaceKey, stubSpace(spaceKey));
}

function stubFor(spaceKey: string): SpaceStub {
  const stub = stubs.get(spaceKey);
  if (stub === undefined) throw new Error(`未接続のスペース: ${spaceKey}`);
  return stub;
}

beforeEach(() => {
  fakeBrowser.reset();
  stubs.clear();
  vi.mocked(createClient).mockImplementation((host) => stubFor(host.split('.')[0] ?? host).client);
});

describe('スペースのマスタ', () => {
  it('プロジェクト一覧と自分の ID をまとめて持つ', async () => {
    await connect('nulab');

    const masters = await loadMasters('nulab', NOW);

    expect(masters?.spaceKey).toBe('nulab');
    expect(masters?.projects).toEqual([
      { id: 10, projectKey: 'WEB', name: 'Webリニューアル' },
      { id: 20, projectKey: 'OPS', name: '運用' },
    ]);
    expect(masters?.myUserId).toBe(MY_USER_ID);
  });

  it('アーカイブしたプロジェクトは載らない', async () => {
    await connect('nulab');
    stubFor('nulab').projects.mockResolvedValue([
      ...PROJECTS,
      {
        id: 30,
        projectKey: 'OLD',
        name: '旧サイト',
        archived: true,
        displayOrder: 2,
        useWiki: true,
      },
    ]);

    const masters = await loadMasters('nulab', NOW);

    expect(masters?.projects.map((project) => project.projectKey)).toEqual(['WEB', 'OPS']);
  });

  it('ユーザー一覧 API は呼ばない', async () => {
    await connect('nulab');
    await loadMasters('nulab', NOW);

    const paths = stubFor('nulab').get.mock.calls.map(([path]) => path);
    expect(paths).toContain('users/myself');
    expect(paths).not.toContain('users');
  });

  it('取得できた認証情報は戻り値に載らない', async () => {
    await connect('nulab');

    const masters = await loadMasters('nulab', NOW);

    expect(JSON.stringify(masters)).not.toContain('key-for-nulab');
  });

  it('TTL 内はキャッシュを返し API を呼ばない', async () => {
    await connect('nulab');

    const first = await loadMasters('nulab', NOW);
    const second = await loadMasters('nulab', NOW + MASTERS_TTL_MS - 1);

    expect(second).toEqual(first);
    expect(stubFor('nulab').projects).toHaveBeenCalledTimes(1);
  });

  it('TTL を過ぎたら取り直す', async () => {
    await connect('nulab');

    await loadMasters('nulab', NOW);
    const refreshed = await loadMasters('nulab', NOW + MASTERS_TTL_MS);

    expect(stubFor('nulab').projects).toHaveBeenCalledTimes(2);
    expect(refreshed?.fetchedAt).toBe(NOW + MASTERS_TTL_MS);
  });

  it('取得に失敗しても例外を投げず、マスタ無しとして扱える', async () => {
    await connect('nulab');
    stubFor('nulab').projects.mockRejectedValue(new Error('401'));

    await expect(loadMasters('nulab', NOW)).resolves.toBeUndefined();
  });

  it('自分の ID が取れなくてもプロジェクト一覧は残る', async () => {
    await connect('nulab');
    stubFor('nulab').get.mockRejectedValue(new Error('403'));

    const masters = await loadMasters('nulab', NOW);

    expect(masters?.myUserId).toBeUndefined();
    expect(masters?.projects).toHaveLength(2);
  });

  it('未接続のスペースは API を呼ばずにマスタ無しを返す', async () => {
    await expect(loadMasters('acme', NOW)).resolves.toBeUndefined();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('接続済み全スペースのマスタ', () => {
  it('1 スペースの失敗が他スペースの取得を止めない', async () => {
    await connect('nulab');
    await connect('acme');
    stubFor('acme').projects.mockRejectedValue(new Error('500'));

    const all = await loadAllMasters(NOW);

    expect(all.map((masters) => masters.spaceKey)).toEqual(['nulab']);
    expect(stubFor('nulab').projects).toHaveBeenCalledTimes(1);
  });
});

describe('プロジェクトごとのステータス', () => {
  it('先読みでは引かず、必要になったプロジェクトのぶんだけ足す', async () => {
    await connect('nulab');

    const masters = await loadMasters('nulab', NOW);
    expect(masters?.statuses).toEqual({});
    expect(stubFor('nulab').statuses).not.toHaveBeenCalled();

    const statuses = await loadProjectStatuses('nulab', 'WEB', NOW);

    expect(statuses).toEqual([
      { id: 1, name: '未対応', color: '#ed8077' },
      { id: 2, name: '処理中', color: '#4488c5' },
    ]);
    expect(stubFor('nulab').statuses).toHaveBeenCalledTimes(1);
    expect((await loadMasters('nulab', NOW))?.statuses).toHaveProperty('WEB');
  });

  it('一度足したプロジェクトのステータスは引き直さない', async () => {
    await connect('nulab');

    await loadProjectStatuses('nulab', 'WEB', NOW);
    await loadProjectStatuses('nulab', 'WEB', NOW);

    expect(stubFor('nulab').statuses).toHaveBeenCalledTimes(1);
  });

  it('ステータスの取得に失敗しても空配列を返す', async () => {
    await connect('nulab');
    stubFor('nulab').statuses.mockRejectedValue(new Error('429'));

    await expect(loadProjectStatuses('nulab', 'WEB', NOW)).resolves.toEqual([]);
  });
});

describe('マスタの破棄', () => {
  it('破棄したあとは取り直す', async () => {
    await connect('nulab');

    await loadMasters('nulab', NOW);
    await invalidateMasters('nulab');
    await loadMasters('nulab', NOW);

    expect(stubFor('nulab').projects).toHaveBeenCalledTimes(2);
  });

  it('スペースを指定しなければ全スペースぶん破棄する', async () => {
    await connect('nulab');
    await connect('acme');

    await loadAllMasters(NOW);
    await invalidateMasters();
    await loadAllMasters(NOW);

    expect(stubFor('nulab').projects).toHaveBeenCalledTimes(2);
    expect(stubFor('acme').projects).toHaveBeenCalledTimes(2);
  });
});
