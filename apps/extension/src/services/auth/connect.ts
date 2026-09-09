import { isTrustedPageOrigin } from '../../messaging/window.ts';
import { type SpaceConnection, spacesItem } from '../../storage/schema.ts';
import { readPageScope } from '../pageContext.ts';
import { authHeaders, forgetCredentials, type SpaceCredential, saveApiKey } from './credentials.ts';

export type ConnectResult =
  | { ok: true; connection: SpaceConnection }
  | { ok: false; reason: 'invalidKey' | 'unreachable' | 'alreadyConnected' };

type Verification = 'ok' | 'invalidKey' | 'unreachable';

/**
 * 認証情報が実際に通るかを 1 回の呼び出しで確かめる。
 *
 * services/backlog/client.ts の `createClient(host, credential)` を使わない。あちらは
 * 最初の呼び出し前に `GET /api/v2/rateLimit` で枠を実測するので、キー 1 本の
 * 確認に 2 往復かかる。fetch を直接使うのはこの関数だけに閉じてあり、
 * 差し替えるときはここだけを見ればよい。
 */
async function verifyCredential(host: string, credential: SpaceCredential): Promise<Verification> {
  let response: Response;
  try {
    response = await fetch(`https://${host}/api/v2/users/myself`, {
      headers: authHeaders(credential),
    });
  } catch {
    // 例外を持ち回らない。認証情報を含む Request が付いた Error がログへ流れる経路を作らない
    return 'unreachable';
  }

  if (response.ok) return 'ok';
  return response.status === 401 || response.status === 403 ? 'invalidKey' : 'unreachable';
}

/**
 * 入力されたホストを、スペースのオリジンとして受け付けられるかで判定する。
 *
 * `isTrustedPageOrigin` の `customHosts` を呼び出し側から受け取らない。接続の入口で
 * 任意のホストを許すと、§2.3 のオリジン検証が接続経路から回避できてしまう。
 * Enterprise のカスタムドメインは、明示的な許可の受け皿を別に用意してから扱う（§18-3）。
 */
export function resolveSpaceKey(host: string): string | undefined {
  const origin = `https://${host}`;
  if (!isTrustedPageOrigin(origin)) return undefined;

  return readPageScope(origin).spaceKey;
}

export async function listConnections(): Promise<SpaceConnection[]> {
  return spacesItem.getValue();
}

export async function rememberConnection(connection: SpaceConnection): Promise<void> {
  const spaces = await spacesItem.getValue();
  const others = spaces.filter((space) => space.spaceKey !== connection.spaceKey);
  await spacesItem.setValue([...others, connection]);
}

/** API キーで接続する。キーの正しさは `users/myself` を叩いて確かめる */
export async function connectWithApiKey(
  host: string,
  apiKey: string,
  now: number,
): Promise<ConnectResult> {
  const normalizedHost = host.trim().toLowerCase();
  const spaceKey = resolveSpaceKey(normalizedHost);
  /*
   * ホストが妥当でないときも unreachable。理由を増やさないのは、C1 の 1 行に出せる
   * 案内が「そのスペースに届かない」以上に分岐しないため（§13）。
   */
  if (spaceKey === undefined) return { ok: false, reason: 'unreachable' };

  const spaces = await listConnections();
  if (spaces.some((space) => space.spaceKey === spaceKey || space.host === normalizedHost)) {
    return { ok: false, reason: 'alreadyConnected' };
  }

  const verification = await verifyCredential(normalizedHost, { method: 'apiKey', apiKey });
  if (verification !== 'ok') return { ok: false, reason: verification };

  const connection: SpaceConnection = {
    spaceKey,
    host: normalizedHost,
    method: 'apiKey',
    displayName: spaceKey,
    lastSyncedAt: now,
    state: 'connected',
  };

  await saveApiKey(spaceKey, apiKey);
  await rememberConnection(connection);

  return { ok: true, connection };
}

/** 接続を解除する。認証情報も同時に消す。片方だけ残ると「未接続なのに 401 が出る」 */
export async function disconnect(spaceKey: string): Promise<void> {
  const spaces = await spacesItem.getValue();
  await spacesItem.setValue(spaces.filter((space) => space.spaceKey !== spaceKey));
  await forgetCredentials(spaceKey);
}

/**
 * 再接続が必要な状態にする。認証情報は消さない。
 *
 * 失効の原因はアクセストークンの期限切れが大半で、リフレッシュトークンや API キーは
 * そのまま使えることがある。ここで消すと、再接続でしか復帰できなくなる（§13 の行内導線）。
 */
export async function markNeedsReconnect(spaceKey: string): Promise<void> {
  const spaces = await spacesItem.getValue();
  await spacesItem.setValue(
    spaces.map((space) =>
      space.spaceKey === spaceKey ? { ...space, state: 'needsReconnect' } : space,
    ),
  );
}
