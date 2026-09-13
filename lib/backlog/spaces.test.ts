import { describe, expect, it, vi } from 'vitest';

import type { ConnectedSpace } from '@/lib/connect/connectSpace';

import { disconnectSpace, markNeedsReconnect, type SpaceStores } from './spaces';

const space = (host: string): ConnectedSpace => ({
  host,
  name: host,
  spaceKey: host.split('.')[0] ?? host,
  projectCount: 1,
  connectedAt: 0,
});

function fakeStores(initial: ConnectedSpace[]) {
  let records = initial;
  const stores = {
    removeApiKey: vi.fn(() => Promise.resolve()),
    spaces: {
      load: () => Promise.resolve(records),
      save: (next: readonly ConnectedSpace[]) => {
        records = [...next];
        return Promise.resolve();
      },
    },
    removeRateLimit: vi.fn(() => Promise.resolve()),
    dropQueries: vi.fn<(host: string) => void>(),
  } satisfies SpaceStores;
  return { stores, records: () => records };
}

describe('スペースの削除', () => {
  it('鍵・記録・レート状態・キャッシュをそのホストの分だけ消し、他のスペースは残る', async () => {
    const { stores, records } = fakeStores([space('a.backlog.jp'), space('b.backlog.com')]);

    await disconnectSpace('a.backlog.jp', stores);

    expect(stores.removeApiKey).toHaveBeenCalledWith('a.backlog.jp');
    expect(stores.removeRateLimit).toHaveBeenCalledWith('a.backlog.jp');
    expect(stores.dropQueries).toHaveBeenCalledWith('a.backlog.jp');
    expect(records().map((s) => s.host)).toEqual(['b.backlog.com']);
  });
});

describe('認証切れの印', () => {
  it('401 を受けたスペースにだけ needsReconnect が付き、鍵は消えない', async () => {
    const { stores, records } = fakeStores([space('a.backlog.jp'), space('b.backlog.com')]);

    await markNeedsReconnect('a.backlog.jp', stores);

    expect(records()).toEqual([
      expect.objectContaining({ host: 'a.backlog.jp', needsReconnect: true }),
      expect.not.objectContaining({ needsReconnect: true }),
    ]);
    expect(stores.removeApiKey).not.toHaveBeenCalled();
  });
});
