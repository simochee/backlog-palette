import { parsePath } from '@/lib/nav';
import { entityId } from '@/lib/palette';
import { activity, transitions } from '@/lib/storage/palette-items';

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
 * パレットから遷移したことを行動ログに残す（palette.md §9 の頻度 × 直近性、D-16 の遷移パターン）。
 * 学習オフのときは呼ばれない。件名や語は書かない。対象の id と時刻だけ
 */
export async function recordNavigation(url: string, context: OpenContext, now: number) {
  const target = entityIdOfUrl(url);
  if (target === undefined) return;
  const log = await activity.getValue();
  await activity.setValue([{ entityId: target, at: now }, ...log].slice(0, LOG_LIMIT));

  const info = parsePath(new URL(url).pathname);
  if (context.pageKind === undefined || info?.kind !== 'page') return;
  const history = await transitions.getValue();
  await transitions.setValue(
    [{ from: context.pageKind, to: info.pageId, at: now }, ...history].slice(0, LOG_LIMIT),
  );
}
