import type { QueryClient } from '@tanstack/query-core';
import { type Persister, persistQueryClient } from '@tanstack/query-persist-client-core';

import { queryCache } from '@/lib/storage/items';

import { PERSIST_MAX_AGE_MS, shouldPersistQuery } from './queryClient';

const storagePersister: Persister = {
  persistClient: (client) => queryCache.setValue(client),
  restoreClient: async () => (await queryCache.getValue()) ?? undefined,
  removeClient: () => queryCache.removeValue(),
};

/**
 * キャッシュを storage に繋ぐ。戻りの promise は復元の完了で、それまでに描くと
 * キャッシュが無い状態の描画になる。パレットは表示キャッシュだけで先に描くので待たない。
 */
export function persistToStorage(queryClient: QueryClient): {
  restored: Promise<void>;
  stop: () => void;
} {
  const [stop, restored] = persistQueryClient({
    queryClient,
    persister: storagePersister,
    maxAge: PERSIST_MAX_AGE_MS,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  });
  return { restored, stop };
}
