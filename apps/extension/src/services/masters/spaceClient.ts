import { listConnections } from '../auth/connect.ts';
import { credentialFor } from '../auth/credentials.ts';
import { type BacklogClient, createClient } from '../backlog/index.ts';

/**
 * 接続済みスペース 1 つ分の API クライアントを組み立てる。
 *
 * 認証情報はこの関数の内側で消費し、戻り値にも例外にも載せない（実装プラン §2.3）。
 */
export async function spaceClientFor(spaceKey: string): Promise<BacklogClient | undefined> {
  const connection = (await listConnections()).find((space) => space.spaceKey === spaceKey);
  if (connection === undefined) return undefined;

  const credential = await credentialFor(spaceKey);
  if (credential === undefined) return undefined;

  return createClient(connection.host, credential);
}
