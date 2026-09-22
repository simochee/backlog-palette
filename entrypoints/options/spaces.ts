import type { SpaceItemView } from '@/components/types';
import { removeApiKey } from '@/lib/backlog/apiKeys';
import type { ConnectedSpace } from '@/lib/connect/connectSpace';
import { apiKeyPageUrl } from '@/lib/connect/page';
import { spacesCollection } from '@/lib/storage/definitions';
import { displayCache, rateLimits, spaces } from '@/lib/storage/items';

/** 設定画面に 1 つ。パレットや接続シートが書いた記録も item の watch で追う */
export const connectedSpaces = spacesCollection(spaces);

const syncedAt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** id は host（D-32）。SpaceList はこの id で onReconnect / onDisconnect を返す */
export function toSpaceItems(stored: readonly ConnectedSpace[]): SpaceItemView[] {
  return stored.map((space) => ({
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
 *
 * 記録より先に鍵を消す。記録を先に消して鍵の削除が失敗すると、一覧に出ないので
 * 消せない鍵が残り、パレットはその鍵で接続済みのまま API を叩き続ける
 */
export async function disconnectSpace(host: string): Promise<void> {
  await removeApiKey(host);
  await connectedSpaces.delete(host).isPersisted.promise;
  await rateLimits.setValue(without(await rateLimits.getValue(), host));
  const cached = await displayCache.getValue();
  await displayCache.setValue(cached.filter((entry) => entry.spaceHost !== host));
}
