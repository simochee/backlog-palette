import { readApiKey } from './apiKeys';
import { createSpaceClient, type SpaceClient } from './client';
import { NotConnectedError } from './failure';
import { platformFetch } from './platformFetch';
import { sharedRateLimiter } from './rateLimitStorage';

const clients = new Map<string, { apiKey: string; client: SpaceClient }>();

/**
 * ホストに対応するクライアント。鍵はそのたびに storage から読み、変わっていれば
 * 作り直す。再接続や別スペースへの切り替えは、鍵が変わることでここに現れる。
 */
export async function clientFor(spaceHost: string): Promise<SpaceClient> {
  const apiKey = await readApiKey(spaceHost);
  if (apiKey === undefined) throw new NotConnectedError(spaceHost);
  const known = clients.get(spaceHost);
  if (known?.apiKey === apiKey) return known.client;
  const client = createSpaceClient({
    spaceHost,
    apiKey,
    rateLimiter: sharedRateLimiter,
    fetch: platformFetch,
  });
  clients.set(spaceHost, { apiKey, client });
  return client;
}
