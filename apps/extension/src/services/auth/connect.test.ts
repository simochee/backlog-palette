import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { spacesItem } from '../../storage/schema.ts';
import { connectWithApiKey, disconnect, listConnections, markNeedsReconnect } from './connect.ts';
import { credentialFor, saveApiKey } from './credentials.ts';

const NOW = Date.UTC(2026, 8, 10);
const HOST = 'simochee.backlog.com';

function respondWith(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn<typeof fetch>();

describe('スペースの接続', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(respondWith(200, { id: 1, name: 'しもち' }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('API キーが通ればスペースキーとホストを接続済みとして残す', async () => {
    const result = await connectWithApiKey(HOST, 'api-key', NOW);

    expect(result).toEqual({
      ok: true,
      connection: {
        spaceKey: 'simochee',
        host: HOST,
        method: 'apiKey',
        displayName: 'simochee',
        lastSyncedAt: NOW,
        state: 'connected',
      },
    });
    expect(await listConnections()).toHaveLength(1);
  });

  it('接続に成功したスペースには認証情報が付く', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);

    expect(await credentialFor('simochee')).toEqual({ method: 'apiKey', apiKey: 'api-key' });
  });

  it('接続一覧には認証情報が入らない', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);

    expect(JSON.stringify(await listConnections())).not.toContain('api-key');
  });

  it('キーの確認はヘッダで送り、URL にキーを載せない', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`https://${HOST}/api/v2/users/myself`);
    expect(init?.headers).toEqual({ 'Backlog-API-Key': 'api-key' });
  });

  it('Backlog のスペースではないホストは API を呼ばずに弾く', async () => {
    expect(await connectWithApiKey('evil.example.com', 'api-key', NOW)).toEqual({
      ok: false,
      reason: 'unreachable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('スペースを持たない Backlog のサイトも弾く', async () => {
    expect(await connectWithApiKey('www.backlog.com', 'api-key', NOW)).toEqual({
      ok: false,
      reason: 'unreachable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('妥当でないホストは接続一覧にも認証情報にも残らない', async () => {
    await connectWithApiKey('evil.example.com', 'api-key', NOW);

    expect(await listConnections()).toEqual([]);
    expect(await credentialFor('evil')).toBeUndefined();
  });

  it('キーが受け付けられなければ invalidKey を返す', async () => {
    fetchMock.mockResolvedValue(respondWith(401));

    expect(await connectWithApiKey(HOST, 'wrong-key', NOW)).toEqual({
      ok: false,
      reason: 'invalidKey',
    });
    expect(await listConnections()).toEqual([]);
  });

  it('キーが違うときは認証情報を保管しない', async () => {
    fetchMock.mockResolvedValue(respondWith(403));

    await connectWithApiKey(HOST, 'wrong-key', NOW);

    expect(await credentialFor('simochee')).toBeUndefined();
  });

  it('スペースに届かなければ unreachable を返す', async () => {
    fetchMock.mockRejectedValue(new Error('network'));

    expect(await connectWithApiKey(HOST, 'api-key', NOW)).toEqual({
      ok: false,
      reason: 'unreachable',
    });
  });

  it('スペース側が落ちているときも unreachable を返す', async () => {
    fetchMock.mockResolvedValue(respondWith(500));

    expect(await connectWithApiKey(HOST, 'api-key', NOW)).toEqual({
      ok: false,
      reason: 'unreachable',
    });
  });

  it('接続済みのスペースをもう一度接続しようとすると alreadyConnected を返す', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);
    fetchMock.mockReset();

    expect(await connectWithApiKey(HOST, 'another-key', NOW)).toEqual({
      ok: false,
      reason: 'alreadyConnected',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('二重接続では保管済みのキーを書き換えない', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);

    await connectWithApiKey(HOST, 'another-key', NOW);

    expect(await credentialFor('simochee')).toEqual({ method: 'apiKey', apiKey: 'api-key' });
  });

  it('接続を解除すると一覧から消え、認証情報も実際に消える', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);

    await disconnect('simochee');

    expect(await listConnections()).toEqual([]);
    expect(await credentialFor('simochee')).toBeUndefined();
    expect(JSON.stringify(await fakeBrowser.storage.local.get(null))).not.toContain('api-key');
  });

  it('解除したスペースは同じキーで接続しなおせる', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);
    await disconnect('simochee');

    expect((await connectWithApiKey(HOST, 'api-key', NOW)).ok).toBe(true);
  });

  it('再接続が必要な状態にすると一覧の状態だけが変わる', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);

    await markNeedsReconnect('simochee');

    expect((await listConnections())[0]?.state).toBe('needsReconnect');
    expect(await credentialFor('simochee')).toBeDefined();
  });

  it('接続していないスペースの一覧は空で始まる', async () => {
    expect(await listConnections()).toEqual([]);
    expect(await spacesItem.getValue()).toEqual([]);
  });

  it('別のスペースを解除しても接続は残る', async () => {
    await connectWithApiKey(HOST, 'api-key', NOW);
    await saveApiKey('acme', 'acme-key');

    await disconnect('acme');

    expect((await listConnections()).map((space) => space.spaceKey)).toEqual(['simochee']);
  });
});
