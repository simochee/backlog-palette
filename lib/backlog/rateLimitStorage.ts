import { rateLimits } from '@/lib/storage/items';

import { createRateLimiter, type RateLimiter, type RateLimitStore } from './rateLimit';

const storageBackedStore: RateLimitStore = {
  load: async (spaceHost) => (await rateLimits.getValue())[spaceHost],
  save: async (spaceHost, record) => {
    const all = await rateLimits.getValue();
    await rateLimits.setValue({ ...all, [spaceHost]: record });
  },
};

/** 拡張ページが共有するレート制御。状態は storage にあり、タブをまたいで 1 つの残数を見る */
export const sharedRateLimiter: RateLimiter = createRateLimiter(storageBackedStore);
