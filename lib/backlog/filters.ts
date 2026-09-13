import type { Option } from 'backlog-js';

import { defaultConditions, type SearchConditions } from '@/lib/share';

import type { EntityKind, IssueLike } from './entries';
import { expandNotClosed, type StatusesByProject, unionStatusIds } from './statuses';

/** サイドパネルのフィルターバー（surfaces.md §5.3）の条件。形は lib/share の zod スキーマが持つ */
export type { SearchConditions };
export { defaultConditions };

export const searchKinds: readonly EntityKind[] = ['issue', 'wiki', 'document'];

/** 種別の条件で走らせる種別。他の条件は課題にしか効かない（Wiki・ドキュメントに状態と担当者は無い） */
export function kindsFor(type: SearchConditions['type']): readonly EntityKind[] {
  return type === 'all' ? searchKinds : [type];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const UPDATED_DAYS = { week: 7, month: 30, quarter: 90 } as const;

function updatedSince(updated: SearchConditions['updated'], now: number): string | undefined {
  if (updated === 'any') return undefined;
  return new Date(now - UPDATED_DAYS[updated] * DAY_MS).toISOString().slice(0, 10);
}

export type ExpansionContext = {
  statusesByProject: StatusesByProject;
  myselfId: number;
  now: number;
};

export type IssueSearchPlan = {
  params: Pick<Option.Issue.GetIssuesParams, 'statusId' | 'assigneeId' | 'updatedSince'>;
  /** API のパラメータで表せない条件。取った後に手元で絞る */
  postFilter: (issue: IssueLike) => boolean;
};

/**
 * パネルの条件を GET /issues のパラメータに展開する。状態はプロジェクトごとに ID が
 * 違うので「完了を除く」はプロジェクトごとの集合に展開してから合併する（backlog-facts.md §3.5）。
 *
 * 担当者「未設定」は API に対応するパラメータが台帳に無い（§3.2）。推測で assigneeId=0 を
 * 送らず、取った結果から担当者の無い課題を残す。
 */
export function planIssueSearch(
  conditions: SearchConditions,
  context: ExpansionContext,
): IssueSearchPlan {
  const params: IssueSearchPlan['params'] = {};
  if (conditions.status.kind === 'notClosed') {
    params.statusId = unionStatusIds(expandNotClosed(context.statusesByProject));
  } else if (conditions.status.kind === 'status') {
    params.statusId = [conditions.status.statusId];
  }
  if (conditions.assignee === 'me') params.assigneeId = [context.myselfId];
  const since = updatedSince(conditions.updated, context.now);
  if (since !== undefined) params.updatedSince = since;
  return {
    params,
    postFilter:
      conditions.assignee === 'unassigned' ? (issue) => issue.assignee === undefined : () => true,
  };
}
