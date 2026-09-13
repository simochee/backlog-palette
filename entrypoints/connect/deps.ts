import { saveApiKey } from '@/lib/backlog/apiKeys';
import { createSpaceClient } from '@/lib/backlog/client';
import { sharedRateLimiter } from '@/lib/backlog/rateLimitStorage';
import type { ConnectDeps } from '@/lib/connect/connectSpace';
import { spaces } from '@/lib/storage/items';

export const connectDeps: ConnectDeps = {
  createClient: (spaceHost, apiKey) =>
    createSpaceClient({ spaceHost, apiKey, rateLimiter: sharedRateLimiter }),
  saveApiKey,
  initializeRateLimit: sharedRateLimiter.initialize,
  saveSpace: async (spaceHost, space) => {
    const all = await spaces.getValue();
    await spaces.setValue({ ...all, [spaceHost]: space });
  },
};
