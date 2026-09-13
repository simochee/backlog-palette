import { apiKeys, rateLimits, spaces } from '@/lib/storage/items';

import type { SpaceStores } from './spaces';

async function removeKeyOf<T>(
  item: {
    getValue: () => Promise<Record<string, T>>;
    setValue: (v: Record<string, T>) => Promise<void>;
  },
  host: string,
): Promise<void> {
  const { [host]: _removed, ...rest } = await item.getValue();
  await item.setValue(rest);
}

/** 拡張ページが disconnectSpace / markNeedsReconnect に渡す storage の実体。dropQueries は呼ぶ側が足す */
export const spaceStores: Omit<SpaceStores, 'dropQueries'> = {
  removeApiKey: (host) => removeKeyOf(apiKeys, host),
  spaces: { load: () => spaces.getValue(), save: (next) => spaces.setValue([...next]) },
  removeRateLimit: (host) => removeKeyOf(rateLimits, host),
};
