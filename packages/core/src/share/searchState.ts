/** スキーマ版。未知の版は復元せず、呼び出し側が案内を出す（docs/implementation-plan.md §7.5） */
export const SEARCH_STATE_VERSION = 1;

export type SearchScope =
  | { kind: 'allSpaces' }
  | { kind: 'space'; spaceKey: string }
  | { kind: 'project'; spaceKey: string; projectKey: string };

export type SearchResultType = 'issue' | 'wiki' | 'document';

/**
 * 条件はすべて AND、各条件は単一選択（§3 D5）。
 * OR が要る現実の要求はプリセットで吸収する。
 */
export type StatusFilter =
  | { kind: 'any' }
  | { kind: 'status'; statusId: number }
  | { kind: 'preset'; preset: 'openOnly' };

export type AssigneeFilter = { kind: 'any' } | { kind: 'me' } | { kind: 'user'; userId: number };

export type UpdatedFilter = { kind: 'any' } | { kind: 'withinDays'; days: number };

export type KeywordTarget = 'subject' | 'subjectAndBody' | 'subjectBodyAndComment';

/** サイドパネルのフィルターバーが表す検索状態（§5.3） */
export type SearchState = {
  v: typeof SEARCH_STATE_VERSION;
  query: string;
  scope: SearchScope;
  types: readonly SearchResultType[];
  status: StatusFilter;
  assignee: AssigneeFilter;
  issueTypeId?: number;
  updated: UpdatedFilter;
  keywordTarget: KeywordTarget;
};

export const allSearchResultTypes: readonly SearchResultType[] = ['issue', 'wiki', 'document'];

export const defaultSearchState: SearchState = {
  v: SEARCH_STATE_VERSION,
  query: '',
  scope: { kind: 'allSpaces' },
  types: allSearchResultTypes,
  status: { kind: 'any' },
  assignee: { kind: 'any' },
  updated: { kind: 'any' },
  keywordTarget: 'subject',
};
