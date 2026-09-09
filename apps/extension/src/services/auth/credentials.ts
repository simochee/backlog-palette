import { storage } from 'wxt/utils/storage';

/**
 * スペースごとの認証情報。読み書きするのは Service Worker だけ（実装プラン §2.3）。
 *
 * ストレージ項目を storage/schema.ts に置かない。あちらは storage/index.ts から
 * まとめて re-export されるので、認証情報の項目を混ぜると UI 側のモジュールからも
 * 1 行の import で辿れてしまう。ここに閉じておけば、持ち出しは import の追加として
 * レビューに現れる。
 */

type OAuthSession = { accessToken: string; expiresAt?: number };
type PersistedSecret = { refreshToken?: string; apiKey?: string };

/** §9 の `session:tokens`。ブラウザを閉じたら消える */
const accessTokensItem = storage.defineItem<Record<string, OAuthSession>>('session:tokens', {
  fallback: {},
  version: 1,
});

/** §9 の `local:refreshTokens`。リフレッシュトークンと API キーが同居する */
const persistedSecretsItem = storage.defineItem<Record<string, PersistedSecret>>(
  'local:refreshTokens',
  { fallback: {}, version: 1 },
);

/**
 * リクエストに付ける認証情報。
 *
 * services/backlog/client.ts が同名・同形の型を持つ。ヘッダを組み立てる関数を
 * 渡す形（メッセージに載せようとした時点で structuredClone が失敗する）にはできない。
 * あちらの土台の backlog-js が生の値を要求するためで、形を合わせて
 * `credentialFor()` の戻り値をそのまま `createClient()` に渡せるようにしてある。
 * どちらかが片方を import する形に寄せるのは、両方の実装が出揃ってからにする。
 */
export type SpaceCredential =
  | { readonly method: 'apiKey'; readonly apiKey: string }
  | { readonly method: 'oauth'; readonly accessToken: string };

/** API キーはクエリではなくヘッダで渡す。URL とログにキーが残らない（docs/backlog-facts.md §3.1） */
export function authHeaders(credential: SpaceCredential): Record<string, string> {
  return credential.method === 'apiKey'
    ? { 'Backlog-API-Key': credential.apiKey }
    : { Authorization: `Bearer ${credential.accessToken}` };
}

/*
 * 保管は上書きで、そのスペースの前の秘密を残さない。1 スペース 1 方式なので、
 * 併合すると方式を変えたときに使わない秘密が残り続ける。
 */
export async function saveApiKey(spaceKey: string, apiKey: string): Promise<void> {
  const secrets = await persistedSecretsItem.getValue();
  await persistedSecretsItem.setValue({ ...secrets, [spaceKey]: { apiKey } });
}

export async function saveAccessToken(
  spaceKey: string,
  session: OAuthSession,
  refreshToken?: string,
): Promise<void> {
  const tokens = await accessTokensItem.getValue();
  await accessTokensItem.setValue({ ...tokens, [spaceKey]: session });

  if (refreshToken === undefined) return;

  const secrets = await persistedSecretsItem.getValue();
  await persistedSecretsItem.setValue({ ...secrets, [spaceKey]: { refreshToken } });
}

/**
 * そのスペースへのリクエストに付ける認証情報。
 *
 * 方式は接続時に決まっているが、ここでは保管されている値だけを見て決める。
 * 接続一覧の `method` を入力にすると、一覧と実体がずれたときに
 * 「接続済みなのに 401」を切り分けられなくなる。
 */
export async function credentialFor(spaceKey: string): Promise<SpaceCredential | undefined> {
  const accessToken = (await accessTokensItem.getValue())[spaceKey]?.accessToken;
  if (accessToken !== undefined) return { method: 'oauth', accessToken };

  const apiKey = (await persistedSecretsItem.getValue())[spaceKey]?.apiKey;
  if (apiKey !== undefined) return { method: 'apiKey', apiKey };

  return undefined;
}

export async function accessTokenExpiresAt(spaceKey: string): Promise<number | undefined> {
  return (await accessTokensItem.getValue())[spaceKey]?.expiresAt;
}

export async function refreshTokenFor(spaceKey: string): Promise<string | undefined> {
  return (await persistedSecretsItem.getValue())[spaceKey]?.refreshToken;
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

export async function forgetCredentials(spaceKey: string): Promise<void> {
  const [tokens, secrets] = await Promise.all([
    accessTokensItem.getValue(),
    persistedSecretsItem.getValue(),
  ]);

  await Promise.all([
    accessTokensItem.setValue(omit(tokens, spaceKey)),
    persistedSecretsItem.setValue(omit(secrets, spaceKey)),
  ]);
}
