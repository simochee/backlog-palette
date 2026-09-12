import type { VisitRecord } from '../messaging/ext.ts';
import { cacheKey, rememberVisit } from '../storage/displayCache.ts';
import { recordActivity } from './activity/index.ts';
import { recentEntryId } from './localIndex.ts';

/**
 * ページを閲覧したときに残すもの（実装プラン §9）。
 *
 * 表示キャッシュは「何を見たか」を、行動ログは「いつ・どう触ったか」を持つ。
 * 件名は表示キャッシュにだけ置き、行動ログにはキーしか入れない。同じ id で
 * 結べるよう、索引の行 id もキャッシュのキーから作る。
 */
export async function recordVisit(record: VisitRecord, now: number): Promise<void> {
  const { spaceKey, id, ...entry } = record;

  await rememberVisit(spaceKey, id, entry, now);
  await recordActivity({
    entityId: recentEntryId(cacheKey(spaceKey, id)),
    kind: 'opened',
    at: now,
  });
}
