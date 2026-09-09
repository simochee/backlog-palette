import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { listConnections } from './connect.ts';
import { credentialFor, refreshTokenFor } from './credentials.ts';
import {
  authorizationUrl,
  connectWithOAuth,
  createState,
  readAuthorizationCode,
  refreshAccessToken,
  setOAuthApp,
} from './oauth.ts';

const NOW = Date.UTC(2026, 8, 10);
const HOST = 'simochee.backlog.com';
const CHROME_REDIRECT = 'https://abcdefghijklmnop.chromiumapp.org/';
const FIREFOX_REDIRECT = 'https://1234abcd.extensions.allizom.org/';

const fetchMock = vi.fn<typeof fetch>();

function issuedTokens(): Response {
  return new Response(
    JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    }),
    { status: 200 },
  );
}

function stateOf(url: string): string {
  return new URL(url).searchParams.get('state') ?? '';
}

function launchedUrl(launch: { mock: { calls: unknown[][] } }): string {
  const [details] = launch.mock.calls[0] ?? [];
  return (details as { url: string }).url;
}

/** 認可の窓の代わりに、要求された state をそのまま返すリダイレクトを組み立てる */
function grantAuthorization(redirect: string, code: string) {
  return async (details: { url: string }) =>
    `${redirect}?code=${code}&state=${stateOf(details.url)}`;
}

describe('OAuth でのスペース接続', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(issuedTokens());
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(fakeBrowser.identity, 'getRedirectURL').mockReturnValue(CHROME_REDIRECT);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('クライアント ID が未設定なら認可の窓を開かない', async () => {
    const launch = vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow');

    expect(await connectWithOAuth(HOST, NOW)).toEqual({ ok: false, reason: 'notConfigured' });
    expect(launch).not.toHaveBeenCalled();
    expect(await listConnections()).toEqual([]);
  });

  it('認可 URL は認可コードフローの問い合わせとして組み立てる', () => {
    const url = authorizationUrl({
      host: HOST,
      clientId: 'client-id',
      redirectUri: CHROME_REDIRECT,
      state: 'state-value',
    });

    expect(url).toBe(
      `https://${HOST}/OAuth2AccessRequest.action?response_type=code&client_id=client-id` +
        `&redirect_uri=${encodeURIComponent(CHROME_REDIRECT)}&state=state-value`,
    );
  });

  it('リダイレクト URI はブラウザから受け取った値をそのまま載せる', async () => {
    vi.spyOn(fakeBrowser.identity, 'getRedirectURL').mockReturnValue(FIREFOX_REDIRECT);
    const launch = vi
      .spyOn(fakeBrowser.identity, 'launchWebAuthFlow')
      .mockImplementation(grantAuthorization(FIREFOX_REDIRECT, 'code-value'));
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });

    await connectWithOAuth(HOST, NOW);

    expect(new URL(launchedUrl(launch)).searchParams.get('redirect_uri')).toBe(FIREFOX_REDIRECT);
  });

  it('state は呼ぶたびに違う値になる', () => {
    expect(createState()).not.toBe(createState());
  });

  it('戻ってきた state が要求した state と一致すれば認可コードを受け取る', () => {
    expect(readAuthorizationCode(`${CHROME_REDIRECT}?code=code-value&state=abc`, 'abc')).toEqual({
      ok: true,
      code: 'code-value',
    });
  });

  it('戻ってきた state が違えば認可コードが付いていても捨てる', () => {
    expect(readAuthorizationCode(`${CHROME_REDIRECT}?code=code-value&state=other`, 'abc')).toEqual({
      ok: false,
      reason: 'stateMismatch',
    });
  });

  it('state が付いていない応答も捨てる', () => {
    expect(readAuthorizationCode(`${CHROME_REDIRECT}?code=code-value`, 'abc')).toEqual({
      ok: false,
      reason: 'stateMismatch',
    });
  });

  it('認可を断られた応答からはコードを取らない', () => {
    expect(
      readAuthorizationCode(`${CHROME_REDIRECT}?error=access_denied&state=abc`, 'abc'),
    ).toEqual({ ok: false, reason: 'denied' });
  });

  it('state が一致しない応答が返ったらトークン交換に進まない', async () => {
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockImplementation(
      async () => `${CHROME_REDIRECT}?code=code-value&state=someone-elses-state`,
    );
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });

    expect(await connectWithOAuth(HOST, NOW)).toEqual({ ok: false, reason: 'stateMismatch' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await listConnections()).toEqual([]);
  });

  it('認可の窓を閉じられたら中断として扱う', async () => {
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockRejectedValue(
      new Error('The user did not approve access.'),
    );
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });

    expect(await connectWithOAuth(HOST, NOW)).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('認可が通るとスペースが OAuth 接続として残り、トークンが保管される', async () => {
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockImplementation(
      grantAuthorization(CHROME_REDIRECT, 'code-value'),
    );
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });

    const result = await connectWithOAuth(HOST, NOW);

    expect(result).toEqual({
      ok: true,
      connection: {
        spaceKey: 'simochee',
        host: HOST,
        method: 'oauth',
        displayName: 'simochee',
        lastSyncedAt: NOW,
        state: 'connected',
      },
    });
    expect(await credentialFor('simochee')).toEqual({
      method: 'oauth',
      accessToken: 'access-token',
    });
    expect(await refreshTokenFor('simochee')).toBe('refresh-token');
  });

  it('認可コードをトークンに交換できなければ接続しない', async () => {
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockImplementation(
      grantAuthorization(CHROME_REDIRECT, 'code-value'),
    );
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));

    expect(await connectWithOAuth(HOST, NOW)).toEqual({ ok: false, reason: 'denied' });
    expect(await listConnections()).toEqual([]);
    expect(await credentialFor('simochee')).toBeUndefined();
  });

  it('Backlog のスペースではないホストは認可の窓を開く前に弾く', async () => {
    const launch = vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow');
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });

    expect(await connectWithOAuth('evil.example.com', NOW)).toEqual({
      ok: false,
      reason: 'unreachable',
    });
    expect(launch).not.toHaveBeenCalled();
  });

  it('接続済みのスペースには認可を求めない', async () => {
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockImplementation(
      grantAuthorization(CHROME_REDIRECT, 'code-value'),
    );
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });
    await connectWithOAuth(HOST, NOW);

    expect(await connectWithOAuth(HOST, NOW)).toEqual({ ok: false, reason: 'alreadyConnected' });
  });
});

describe('アクセストークンの更新', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(issuedTokens());
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(fakeBrowser.identity, 'getRedirectURL').mockReturnValue(CHROME_REDIRECT);
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockImplementation(
      grantAuthorization(CHROME_REDIRECT, 'code-value'),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('クライアント ID が未設定なら更新を試みない', async () => {
    expect(await refreshAccessToken('simochee', NOW)).toEqual({
      ok: false,
      reason: 'notConfigured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('接続していないスペースは更新できない', async () => {
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });

    expect(await refreshAccessToken('acme', NOW)).toEqual({ ok: false, reason: 'notConnected' });
  });

  it('更新に成功すると新しいアクセストークンに入れ替わる', async () => {
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });
    await connectWithOAuth(HOST, NOW);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'next-token', expires_in: 3600 }), {
        status: 200,
      }),
    );

    expect(await refreshAccessToken('simochee', NOW)).toEqual({
      ok: true,
      expiresAt: NOW + 3600000,
    });
    expect(await credentialFor('simochee')).toEqual({
      method: 'oauth',
      accessToken: 'next-token',
    });
  });

  it('更新を断られたスペースは再接続が必要な状態になる', async () => {
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });
    await connectWithOAuth(HOST, NOW);
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));

    expect(await refreshAccessToken('simochee', NOW)).toEqual({ ok: false, reason: 'rejected' });
    expect((await listConnections())[0]?.state).toBe('needsReconnect');
  });

  it('スペースに届かないだけなら再接続は求めない', async () => {
    await setOAuthApp({ clientId: 'client-id', clientSecret: 'client-secret' });
    await connectWithOAuth(HOST, NOW);
    fetchMock.mockRejectedValue(new Error('network'));

    expect(await refreshAccessToken('simochee', NOW)).toEqual({ ok: false, reason: 'unreachable' });
    expect((await listConnections())[0]?.state).toBe('connected');
  });
});
