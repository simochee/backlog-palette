import { z } from 'zod';

/** スキーマ版。未知の版は復元せず、呼び出し側が案内を出す（palette.md §7.6） */
export const SEARCH_STATE_VERSION = 1;

/** 検索の範囲。根では検索しない（D-20）ので、スコープに root は無い */
export const searchScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('space'), spaceId: z.string().min(1) }),
  z.object({
    kind: z.literal('project'),
    spaceId: z.string().min(1),
    projectId: z.string().min(1),
  }),
]);

/**
 * サイドパネルのフィルターバー（surfaces.md §5.3）。条件はすべて AND、各条件は単一選択。
 * Backlog の検索が OR をできないので、「完了を除く」はプリセットとして持つ
 */
export const typeFilterSchema = z.enum(['all', 'issue', 'wiki', 'document']);
export const statusFilterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('notClosed') }),
  z.object({ kind: z.literal('status'), statusId: z.number().int().positive() }),
]);
export const assigneeFilterSchema = z.enum(['all', 'me', 'unassigned']);
export const updatedFilterSchema = z.enum(['any', 'week', 'month', 'quarter']);

export const searchConditionsSchema = z.object({
  type: typeFilterSchema.default('all'),
  status: statusFilterSchema.default({ kind: 'all' }),
  assignee: assigneeFilterSchema.default('all'),
  updated: updatedFilterSchema.default('any'),
});

export const searchStateSchema = z.object({
  v: z.literal(SEARCH_STATE_VERSION),
  query: z.string(),
  scope: searchScopeSchema,
  conditions: searchConditionsSchema.default({
    type: 'all',
    status: { kind: 'all' },
    assignee: 'all',
    updated: 'any',
  }),
});

export type SearchScope = z.infer<typeof searchScopeSchema>;
export type SearchConditions = z.infer<typeof searchConditionsSchema>;
export type SearchState = z.infer<typeof searchStateSchema>;

export const defaultConditions: SearchConditions = searchConditionsSchema.parse({});

export function searchState(
  query: string,
  scope: SearchScope,
  conditions: Partial<SearchConditions> = {},
): SearchState {
  return {
    v: SEARCH_STATE_VERSION,
    query,
    scope,
    conditions: { ...defaultConditions, ...conditions },
  };
}

/** 条件を持つ状態はパネルで、語とスコープだけの状態はパレットで復元する（surfaces.md §5.1） */
export function hasConditions(state: SearchState): boolean {
  const { type, status, assignee, updated } = state.conditions;
  return type !== 'all' || status.kind !== 'all' || assignee !== 'all' || updated !== 'any';
}
