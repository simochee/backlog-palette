import type { VisitRecord } from '../messaging/ext.ts';
import { rememberVisit } from '../storage/displayCache.ts';
import { recordActivity } from './activity/index.ts';
import { recentEntryId } from './localIndex.ts';

/**
 * ページを閲覧したときに残すもの（実装プラン §9）。
 *
 * 表示キャッシュは「何を見たか」を、行動ログは「いつ・どう触ったか」を持つ。
 * 分けたまま同じ id で結ぶので、行動ログ側は索引の行 id に合わせる。
 * 表示キャッシュのキー（`{spaceKey}/{識別子}`）で残すと frecency が引けない。
 */
export async function recordVisit(record: VisitRecord, now: number): Promise<void> {
  const { spaceKey, id, ...entry } = record;

  await rememberVisit(spaceKey, id, entry, now);
  await recordActivity({ entityId: recentEntryId(entry.title), kind: 'opened', at: now });
}
