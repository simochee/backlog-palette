import { describe, expect, it, vi } from 'vitest';

import { createCustomDomainRegistry, type CustomDomainApis, normalizeHost } from './customDomains';

function fakeApis(options: { grant?: boolean; hosts?: string[]; registered?: string[] } = {}) {
  let hosts = options.hosts ?? [];
  const registered = new Set(options.registered ?? []);
  const apis = {
    requestOrigin: vi.fn(() => Promise.resolve(options.grant ?? true)),
    removeOrigin: vi.fn(() => Promise.resolve(true)),
    registerContentScript: vi.fn((script: { id: string }) => {
      registered.add(script.id);
      return Promise.resolve();
    }),
    unregisterContentScript: vi.fn((id: string) => {
      registered.delete(id);
      return Promise.resolve();
    }),
    registeredIds: () => Promise.resolve([...registered]),
    contentScript: () => ({ js: ['content-scripts/backlog.js'], runAt: 'document_idle' as const }),
    hosts: {
      load: () => Promise.resolve(hosts),
      save: vi.fn((next: readonly string[]) => {
        hosts = [...next];
        return Promise.resolve();
      }),
    },
  } satisfies CustomDomainApis;
  return { apis, hosts: () => hosts };
}

describe('カスタムドメインの登録', () => {
  it('権限が許可されたら content script を静的なものと同じ内容で登録し、ホストを保存する', async () => {
    const { apis, hosts } = fakeApis();

    const outcome = await createCustomDomainRegistry(apis).register('Backlog.Example.co.jp');

    expect(outcome).toBe('granted');
    expect(apis.requestOrigin).toHaveBeenCalledWith('https://backlog.example.co.jp/*');
    expect(apis.registerContentScript).toHaveBeenCalledWith({
      id: 'backlog-palette:custom:backlog.example.co.jp',
      matches: ['https://backlog.example.co.jp/*'],
      js: ['content-scripts/backlog.js'],
      runAt: 'document_idle',
    });
    expect(hosts()).toEqual(['backlog.example.co.jp']);
  });

  it('権限が拒否されたら何も保存せず登録もしない', async () => {
    const { apis, hosts } = fakeApis({ grant: false });

    const outcome = await createCustomDomainRegistry(apis).register('backlog.example.co.jp');

    expect(outcome).toBe('denied');
    expect(apis.registerContentScript).not.toHaveBeenCalled();
    expect(hosts()).toEqual([]);
  });

});

describe('カスタムドメインの削除と復元', () => {
  it('削除は content script の登録を外し、権限を返し、一覧から消す', async () => {
    const host = 'backlog.example.co.jp';
    const { apis, hosts } = fakeApis({
      hosts: [host],
      registered: [`backlog-palette:custom:${host}`],
    });

    await createCustomDomainRegistry(apis).unregister(host);

    expect(apis.unregisterContentScript).toHaveBeenCalledWith(`backlog-palette:custom:${host}`);
    expect(apis.removeOrigin).toHaveBeenCalledWith(`https://${host}/*`);
    expect(hosts()).toEqual([]);
  });

  it('起動時の復元は、保存済みで未登録のホストだけを登録する', async () => {
    const { apis } = fakeApis({
      hosts: ['a.example', 'b.example'],
      registered: ['backlog-palette:custom:a.example'],
    });

    await createCustomDomainRegistry(apis).restore();

    expect(apis.registerContentScript).toHaveBeenCalledTimes(1);
    expect(apis.registerContentScript).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'backlog-palette:custom:b.example' }),
    );
  });
});

describe('ホスト名の正規化', () => {
  it('スキーム・パス・大文字を落としてホスト名だけにする', () => {
    expect(normalizeHost(' https://Backlog.Example.co.jp/dashboard ')).toBe('backlog.example.co.jp');
    expect(normalizeHost('backlog.example.co.jp')).toBe('backlog.example.co.jp');
  });
});
