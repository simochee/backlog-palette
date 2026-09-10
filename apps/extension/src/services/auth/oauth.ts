import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import type { SpaceConnection } from '../../storage/schema.ts';
import {
  listConnections,
  markNeedsReconnect,
  rememberConnection,
  resolveSpaceKey,
} from './connect.ts';
import { refreshTokenFor, saveAccessToken } from './credentials.ts';

/**
 * OAuth 2.0 の認可コードフロー（実装プラン §10）。
 *
 * OAuth アプリは登録できることを確認済みだが、クライアント ID はまだ発行していない。
 * 未設定のまま呼ばれたら `notConfigured` を返して何もしないので、呼び出し側は
 * 「OAuth はまだ使えない」を C1 の 1 行として出せる。
 */

export type OAuthApp = {
  clientId: string;
  /**
   * Backlog の OAuth が PKCE を受け付けるかは未確認（§18）。受け付けるなら
   * この項目は消せる。確認できるまでは、拡張に秘密鍵を同梱する前提で扱う。
   */
  clientSecret: string;
};

/**
 * OAuth アプリの設定。§9 の表に無いのは、ユーザーのデータではなく配布物の設定だから。
 *
 * storage/schema.ts に置かない。あちらは UI からも読む項目の置き場で、
 * 認証に関わる設定を混ぜると読み手が「どこまでが Service Worker 専用か」を追えなくなる。
 */
const oauthAppItem = storage.defineItem<OAuthApp | null>('local:oauthApp', {
  fallback: null,
  version: 1,
});

export type OAuthFailureReason =
  | 'notConfigured'
  | 'unreachable'
  | 'alreadyConnected'
  | 'cancelled'
  | 'denied'
  | 'stateMismatch';

export type OAuthConnectResult =
  | { ok: true; connection: SpaceConnection }
  | { ok: false; reason: OAuthFailureReason };

export type RefreshResult =
  | { ok: true; expiresAt?: number }
  | { ok: false; reason: 'notConfigured' | 'notConnected' | 'unreachable' | 'rejected' };

export type AuthorizationRequest = {
  host: string;
  clientId: string;
  redirectUri: string;
  state: string;
};

export type AuthorizationCode =
  | { ok: true; code: string }
  | { ok: false; reason: 'denied' | 'stateMismatch' };

const AUTHORIZE_PATH = '/OAuth2AccessRequest.action';
const TOKEN_PATH = '/api/v2/oauth2/token';
const STATE_BYTES = 16;

export async function setOAuthApp(app: OAuthApp | null): Promise<void> {
  await oauthAppItem.setValue(app);
}

export async function loadOAuthApp(): Promise<OAuthApp | undefined> {
  /*
   * ビルド時の env を先に見る。これは利用者のデータではなく配布物の設定なので、
   * 本来ストレージに置く必要がない。置くと、拡張を更新して client_id が変わった
   * ときに古い値が残り続ける。ストレージ側は Enterprise 向けの上書きと
   * テスト用の差し替えのためだけに残す。
   */
  const clientId = import.meta.env.WXT_OAUTH_CLIENT_ID;
  const clientSecret = import.meta.env.WXT_OAUTH_CLIENT_SECRET;
  if (typeof clientId === 'string' && clientId !== '') {
    if (typeof clientSecret === 'string' && clientSecret !== '') {
      return { clientId, clientSecret };
    }
  }

  return (await oauthAppItem.getValue()) ?? undefined;
}

export function createState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(STATE_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * リダイレクト URI はブラウザが決める。Chrome 系と Firefox で別ドメインになるので
 * 値を直書きしない（§10）。認可要求とトークン要求で同じ値を使う必要がある。
 */
function redirectUri(): string {
  return browser.identity.getRedirectURL();
}

export function authorizationUrl(request: AuthorizationRequest): string {
  const url = new URL(`https://${request.host}${AUTHORIZE_PATH}`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', request.clientId);
  url.searchParams.set('redirect_uri', request.redirectUri);
  url.searchParams.set('state', request.state);

  return url.toString();
}

/**
 * 戻ってきたリダイレクト URL から認可コードを読む。
 *
 * state が一致しない応答は、コードが付いていても捨てる（CSRF 対策）。
 */
export function readAuthorizationCode(
  responseUrl: string,
  expectedState: string,
): AuthorizationCode {
  let params: URLSearchParams;
  try {
    params = new URL(responseUrl).searchParams;
  } catch {
    return { ok: false, reason: 'denied' };
  }

  if (params.get('state') !== expectedState) return { ok: false, reason: 'stateMismatch' };

  const code = params.get('code');
  if (code === null || code === '') return { ok: false, reason: 'denied' };

  return { ok: true, code };
}

type IssuedTokens = { accessToken: string; refreshToken?: string; expiresAt?: number };

function readIssuedTokens(payload: unknown, now: number): IssuedTokens | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const fields = payload as Record<string, unknown>;
  if (typeof fields.access_token !== 'string') return undefined;

  const refreshToken = typeof fields.refresh_token === 'string' ? fields.refresh_token : undefined;
  const expiresIn = typeof fields.expires_in === 'number' ? fields.expires_in : undefined;

  return {
    accessToken: fields.access_token,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(expiresIn === undefined ? {} : { expiresAt: now + expiresIn * 1000 }),
  };
}

/**
 * トークン発行の唯一の口。`unreachable`（届かない・壊れた応答）と
 * `rejected`（Backlog が断った）を分ける。前者は再試行、後者はやり直し
 * （接続なら認可のし直し、更新なら再接続待ち）に繋がる。
 *
 * services/backlog/client.ts には載せない。あちらは認証済みの呼び出しを扱う層で、
 * トークン発行をそこに置くと「認証情報を持たない呼び出し」を例外として抱えることになる。
 */
async function requestTokens(
  host: string,
  body: URLSearchParams,
  now: number,
): Promise<IssuedTokens | 'unreachable' | 'rejected'> {
  let response: Response;
  try {
    response = await fetch(`https://${host}${TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    return 'unreachable';
  }

  if (!response.ok) {
    return response.status >= 400 && response.status < 500 ? 'rejected' : 'unreachable';
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return 'unreachable';
  }

  return readIssuedTokens(payload, now) ?? 'unreachable';
}

export async function connectWithOAuth(host: string, now: number): Promise<OAuthConnectResult> {
  const app = await loadOAuthApp();
  if (app === undefined) return { ok: false, reason: 'notConfigured' };

  const normalizedHost = host.trim().toLowerCase();
  const spaceKey = resolveSpaceKey(normalizedHost);
  if (spaceKey === undefined) return { ok: false, reason: 'unreachable' };

  const spaces = await listConnections();
  if (spaces.some((space) => space.spaceKey === spaceKey || space.host === normalizedHost)) {
    return { ok: false, reason: 'alreadyConnected' };
  }

  const state = createState();
  const uri = redirectUri();

  let responseUrl: string | undefined;
  try {
    responseUrl = await browser.identity.launchWebAuthFlow({
      url: authorizationUrl({
        host: normalizedHost,
        clientId: app.clientId,
        redirectUri: uri,
        state,
      }),
      interactive: true,
    });
  } catch {
    // 窓を閉じられた場合も reject で返る。中断とエラーを区別できないので中断として扱う
    return { ok: false, reason: 'cancelled' };
  }

  if (responseUrl === undefined) return { ok: false, reason: 'cancelled' };

  const authorization = readAuthorizationCode(responseUrl, state);
  if (!authorization.ok) return { ok: false, reason: authorization.reason };

  const tokens = await requestTokens(
    normalizedHost,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorization.code,
      redirect_uri: uri,
      client_id: app.clientId,
      client_secret: app.clientSecret,
    }),
    now,
  );
  if (tokens === 'unreachable') return { ok: false, reason: 'unreachable' };
  if (tokens === 'rejected') return { ok: false, reason: 'denied' };

  const connection: SpaceConnection = {
    spaceKey,
    host: normalizedHost,
    method: 'oauth',
    displayName: spaceKey,
    lastSyncedAt: now,
    state: 'connected',
  };

  await saveAccessToken(
    spaceKey,
    {
      accessToken: tokens.accessToken,
      ...(tokens.expiresAt === undefined ? {} : { expiresAt: tokens.expiresAt }),
    },
    tokens.refreshToken,
  );
  await rememberConnection(connection);

  return { ok: true, connection };
}

/**
 * アクセストークンを更新する。断られたときは再接続待ちにする。
 *
 * リフレッシュトークンが無い場合も断られたものとして扱う。session ストレージの
 * アクセストークンだけが消えた状態と区別できず、どちらも再接続でしか復帰しない。
 */
export async function refreshAccessToken(spaceKey: string, now: number): Promise<RefreshResult> {
  const app = await loadOAuthApp();
  if (app === undefined) return { ok: false, reason: 'notConfigured' };

  const connection = (await listConnections()).find((space) => space.spaceKey === spaceKey);
  if (connection === undefined || connection.method !== 'oauth') {
    return { ok: false, reason: 'notConnected' };
  }

  const refreshToken = await refreshTokenFor(spaceKey);
  if (refreshToken === undefined) {
    await markNeedsReconnect(spaceKey);
    return { ok: false, reason: 'rejected' };
  }

  const tokens = await requestTokens(
    connection.host,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: app.clientId,
      client_secret: app.clientSecret,
    }),
    now,
  );

  if (tokens === 'unreachable') return { ok: false, reason: 'unreachable' };
  if (tokens === 'rejected') {
    await markNeedsReconnect(spaceKey);
    return { ok: false, reason: 'rejected' };
  }

  await saveAccessToken(
    spaceKey,
    {
      accessToken: tokens.accessToken,
      ...(tokens.expiresAt === undefined ? {} : { expiresAt: tokens.expiresAt }),
    },
    tokens.refreshToken,
  );

  return { ok: true, ...(tokens.expiresAt === undefined ? {} : { expiresAt: tokens.expiresAt }) };
}
