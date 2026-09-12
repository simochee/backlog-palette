import { type ActivityEvent, frecencyByEntity } from '@backlog-palette/core';
import { ACTIVITY_LIMIT, pruneList } from '../../storage/retention.ts';
import { activityItem } from '../../storage/schema.ts';
import { loadSettings } from '../settings.ts';

/**
 * 行動ログ（実装プラン §9・§7.3）。
 *
 * 残すのは ID・種別・時刻だけ。件名・プロジェクト名は表示キャッシュが持ち、
 * クエリ文字列とページ本文はどこにも残さない。
 */

async function isLearningEnabled(): Promise<boolean> {
  return (await loadSettings()).learningEnabled;
}

export async function recordActivity(event: ActivityEvent): Promise<void> {
  if (!(await isLearningEnabled())) return;

  const current = await activityItem.getValue();
  /*
   * 書き込みのたびに間引く。別途の掃除処理を持つと、掃除が走る前に
   * 上限へ当たる経路が残る（表示キャッシュと同じ方針）。
   * 基準時刻は記録する出来事の時刻にする。ここで Date.now() を読むと、
   * 同じ入力でも結果が変わってテストで固定できない。
   */
  await activityItem.setValue(pruneList([...current, event], event.at, { limit: ACTIVITY_LIMIT }));
}

/** 索引の行 id → frecency。学習がオフなら常に 0 を返す */
export async function frecencyIndex(now: number): Promise<(entryId: string) => number> {
  if (!(await isLearningEnabled())) return () => 0;

  const events = pruneList(await activityItem.getValue(), now, { limit: ACTIVITY_LIMIT });
  const totals = frecencyByEntity(events, now);

  return (entryId) => totals.get(entryId) ?? 0;
}

export async function clearActivity(): Promise<void> {
  await activityItem.removeValue();
}
