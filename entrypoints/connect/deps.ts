import { saveApiKey } from '@/lib/backlog/apiKeys';
import { createSpaceClient } from '@/lib/backlog/client';
import { platformFetch } from '@/lib/backlog/platformFetch';
import { sharedRateLimiter } from '@/lib/backlog/rateLimitStorage';
import { setupBacklogQueries } from '@/lib/backlog/setup';
import type { ConnectDeps } from '@/lib/connect/connectSpace';
import { spaces } from '@/lib/storage/items';

const { queryClient, queries } = setupBacklogQueries();

/** プロジェクトと各プロジェクトのステータスを引き、persister 経由でパレットと共有する */
async function prefetchMasters(spaceHost: string): Promise<{ projectCount: number }> {
  const list = await queryClient.query(queries.projects(spaceHost));
  await queries.statusesOf(spaceHost, list);
  return { projectCount: list.length };
}

export const connectDeps: ConnectDeps = {
  createClient: (spaceHost, apiKey) =>
    createSpaceClient({ spaceHost, apiKey, rateLimiter: sharedRateLimiter, fetch: platformFetch }),
  saveApiKey,
  initializeRateLimit: sharedRateLimiter.initialize,
  prefetchMasters,
  saveSpace: async (space) => {
    const others = (await spaces.getValue()).filter((known) => known.host !== space.host);
    await spaces.setValue([...others, space]);
  },
};
