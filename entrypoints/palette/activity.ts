import { parsePath } from '@/lib/nav';
import { entityId } from '@/lib/palette';
import { fold } from '@/lib/query/normalize';
import { upsertQueryDict } from '@/lib/rank/queryDict';
import { activity, queryDict, transitions } from '@/lib/storage/palette-items';

import type { OpenContext } from './context.ts';

/** 遷移先の URL から行動ログの対象 id を決める。lib/palette の entityId と同じ形 */
export function entityIdOfUrl(url: string): string | undefined {
  const info = parsePath(new URL(url).pathname);
  if (info === undefined) return undefined;
  switch (info.kind) {
    case 'issue':
      return entityId('issue', info.issueKey);
    case 'project':
      return entityId('project', info.projectKey);
    case 'wiki':
      return entityId('wiki', info.name);
    case 'wikiAlias':
      return entityId('wiki', info.wikiId);
    case 'document':
      return entityId('document', info.documentId);
    case 'page':
      return entityId('page', info.pageId);
    default: {
      const unreachable: never = info;
      return unreachable;
    }
  }
}

const LOG_LIMIT = 2000;

/**
 * 語を打って開いたときだけ、語 → 対象を残す（M6 の学習）。語は照合と同じ fold を通し、
 * 打ち方の揺れで記録が分かれないようにする。空の入力（空状態から開いた）は記録しない
 */
async function recordQuery(query: string, target: string, now: number) {
  const folded = fold(query);
  if (folded === '') return;
  const records = await queryDict.getValue();
  await queryDict.setValue(upsertQueryDict(records, folded, target, now));
}

/**
 * パレットから遷移したことを行動ログに残す（palette.md §9 の頻度 × 直近性、D-16 の遷移パターン、
 * M6 の語 → 対象）。学習オフのときは呼ばれない。行動ログには件名や語を書かず、対象の id と時刻だけ。
 * 語 → 対象の辞書だけが語を持つ
 */
export async function recordNavigation(
  url: string,
  context: OpenContext,
  now: number,
  query = '',
) {
  const target = entityIdOfUrl(url);
  if (target === undefined) return;
  const log = await activity.getValue();
  await activity.setValue([{ entityId: target, at: now }, ...log].slice(0, LOG_LIMIT));
  await recordQuery(query, target, now);

  const info = parsePath(new URL(url).pathname);
  if (context.pageKind === undefined || info?.kind !== 'page') return;
  const history = await transitions.getValue();
  await transitions.setValue(
    [{ from: context.pageKind, to: info.pageId, at: now }, ...history].slice(0, LOG_LIMIT),
  );
}
