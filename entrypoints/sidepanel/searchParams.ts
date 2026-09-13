import { z } from 'zod';

import {
  type SearchConditions,
  type SearchScope,
  type SearchState,
  searchState,
} from '@/lib/share';
import { searchConditionsSchema, searchScopeSchema } from '@/lib/share/schema';

/**
 * パネルの 1 ルートが持つ検索状態。`#bl-search` の codec と同じスキーマ（tech-stack.md §3.4）。
 * scope が無いのは、まだどのスペースにも属していないとき（タブが Backlog でなく、渡された検索も無い）
 */
export const panelSearchSchema = z.object({
  query: z.string().default(''),
  scope: searchScopeSchema.optional(),
  conditions: searchConditionsSchema.default(searchConditionsSchema.parse({})),
});

export type PanelSearch = z.infer<typeof panelSearchSchema>;

export function toSearchState(search: PanelSearch): SearchState | undefined {
  if (search.scope === undefined) return undefined;
  return searchState(search.query, search.scope, search.conditions);
}

export function fromSearchState(state: SearchState): PanelSearch {
  return { query: state.query, scope: state.scope, conditions: state.conditions };
}

/** 検索を走らせられる状態か。語が空、または根（D-20）では走らせない */
export function canRun(search: PanelSearch): search is PanelSearch & { scope: SearchScope } {
  return search.scope !== undefined && search.query.trim() !== '';
}

export type { SearchConditions, SearchScope };
