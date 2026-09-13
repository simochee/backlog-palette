import { saveApiKey } from '@/lib/backlog/apiKeys';
import { createSpaceClient } from '@/lib/backlog/client';
import { platformFetch } from '@/lib/backlog/platformFetch';
import { sharedRateLimiter } from '@/lib/backlog/rateLimitStorage';
import type { ConnectDeps } from '@/lib/connect/connectSpace';
import { spaces } from '@/lib/storage/items';

export const connectDeps: ConnectDeps = {
  createClient: (spaceHost, apiKey) =>
    createSpaceClient({ spaceHost, apiKey, rateLimiter: sharedRateLimiter, fetch: platformFetch }),
  saveApiKey,
  initializeRateLimit: sharedRateLimiter.initialize,
  saveSpace: async (space) => {
    const others = (await spaces.getValue()).filter((known) => known.host !== space.host);
    await spaces.setValue([...others, space]);
  },
};
