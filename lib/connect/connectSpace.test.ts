import { Error as BacklogErrors } from 'backlog-js';
import { describe, expect, it, vi } from 'vitest';

import { type ConnectApi, type ConnectDeps, connectSpace } from './connectSpace';

const HOST = 'demo.backlog.jp';
const SPACE = { spaceKey: 'demo', name: 'デモスペース' };
const SNAPSHOT = {
  read: { limit: 600, remaining: 600 },
  search: { limit: 150, remaining: 150 },
  icon: { limit: 60, remaining: 60 },
};

function unauthorized(): Error {
  return new BacklogErrors.BacklogAuthError(new Response(null, { status: 401 }), { errors: [] });
}

function fakeApi(overrides: Partial<ConnectApi> = {}): ConnectApi {
  return {
    getMyself: () => Promise.resolve({ id: 1 }),
    getSpace: () => Promise.resolve(SPACE),
    getRateLimit: () => Promise.resolve({ rateLimit: SNAPSHOT }),
    getProjects: () => Promise.resolve([{ id: 101 }, { id: 102 }]),
    ...overrides,
  };
}

function deps(api: ConnectApi) {
  const recorded = {
    createClient: vi.fn(() => api),
    saveApiKey: vi.fn(() => Promise.resolve()),
    initializeRateLimit: vi.fn(() => Promise.resolve()),
    saveSpace: vi.fn(() => Promise.resolve()),
    now: () => 1_700_000_000_000,
  } satisfies ConnectDeps;
  return recorded;
}

describe('接続の手順', () => {
  it('キーが通ったら保存し、上限とプロジェクト数を記録して表示名を返す', async () => {
    const d = deps(fakeApi());

    const result = await connectSpace(HOST, 'key', d);

    expect(result).toEqual({
      ok: true,
      space: {
        host: HOST,
        name: 'デモスペース',
        spaceKey: 'demo',
        projectCount: 2,
        connectedAt: 1_700_000_000_000,
      },
    });
    expect(d.createClient).toHaveBeenCalledWith(HOST, 'key');
    expect(d.saveApiKey).toHaveBeenCalledWith(HOST, 'key');
    expect(d.initializeRateLimit).toHaveBeenCalledWith(HOST, SNAPSHOT);
    expect(d.saveSpace).toHaveBeenCalledWith(expect.objectContaining({ host: HOST, projectCount: 2 }));
  });

  it('キーの検証に失敗したら何も保存せず unauthorized を返す', async () => {
    const d = deps(fakeApi({ getMyself: () => Promise.reject(unauthorized()) }));

    const result = await connectSpace(HOST, 'wrong', d);

    expect(result).toEqual({ ok: false, failure: { kind: 'unauthorized' } });
    expect(d.saveApiKey).not.toHaveBeenCalled();
    expect(d.saveSpace).not.toHaveBeenCalled();
  });

  it('初期化に失敗しても保存した鍵は残り、失敗を返す', async () => {
    const d = deps(
      fakeApi({ getProjects: () => Promise.reject(new TypeError('Failed to fetch')) }),
    );

    const result = await connectSpace(HOST, 'key', d);

    expect(result).toEqual({ ok: false, failure: { kind: 'offline' } });
    expect(d.saveApiKey).toHaveBeenCalledTimes(1);
    expect(d.saveSpace).not.toHaveBeenCalled();
  });
});
