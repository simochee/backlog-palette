import type { SpaceItemView } from '@/components/types';
import { removeApiKey } from '@/lib/backlog/apiKeys';
import type { ConnectedSpace } from '@/lib/connect/connectSpace';
import { apiKeyPageUrl } from '@/lib/connect/page';
import { displayCache, rateLimits, spaces } from '@/lib/storage/items';

const syncedAt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** id は host（D-32）。SpaceList はこの id で onReconnect / onDisconnect を返す */
export function toSpaceItems(stored: readonly ConnectedSpace[]): SpaceItemView[] {
  return stored
    .toSorted((a, b) => b.connectedAt - a.connectedAt)
    .map((space) => ({
      id: space.host,
      host: space.host,
      label: space.name,
      projectCount: space.projectCount,
      lastSyncedAt: syncedAt.format(space.connectedAt),
      state: space.needsReconnect === true ? 'needsReconnect' : 'connected',
      icon: space.icon,
    }));
}

/** 再接続は API キーの発行ページへ。接続の導線は 1 本（surfaces.md §1.1） */
export function reconnectUrl(host: string): string {
  return apiKeyPageUrl(`https://${host}`);
}

function without<T>(record: Record<string, T>, host: string): Record<string, T> {
  const { [host]: _removed, ...rest } = record;
  return rest;
}

/**
 * 削除は鍵・スペースの記録・レート枠・そのスペースの表示キャッシュを消す（surfaces.md §2）。
 * 行動ログや検索履歴はスペースを持たないので残る。
 */
export async function disconnectSpace(host: string): Promise<void> {
  await removeApiKey(host);
  await spaces.setValue((await spaces.getValue()).filter((space) => space.host !== host));
  await rateLimits.setValue(without(await rateLimits.getValue(), host));
  const cached = await displayCache.getValue();
  await displayCache.setValue(cached.filter((entry) => entry.spaceHost !== host));
}
