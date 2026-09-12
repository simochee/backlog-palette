import type { SearchState } from '@backlog-palette/core';
import type { FilterField, PanelSuggestion } from '@backlog-palette/ui';
import { applyFilter, clearConditions, type FilterContext, filterFields } from './filters.ts';

/**
 * 0 件のときに出す提案（実装プラン §5.3 の B4・§13）。
 *
 * 原因を「効いている条件」と「スコープ」に切り分け、外部の検索は最後に置く。
 * 並び順は `PanelSurface` が group で固定するので、ここは中身だけを作る。
 *
 * 「広げれば N 件」は作らない。件数を出すには広いスコープへ投機的に投げることになり、
 * レート枠をその 1 回で削る（§5.3 の注記）。
 */

export type SuggestionContext = FilterContext & {
  /** いま見ている Backlog のオリジン。分からなければ本体の検索へは誘導しない */
  origin?: string;
};

const CLEAR_ALL = 'suggestion:clearConditions';
const EXTERNAL = 'suggestion:external';

/**
 * 本体の全体検索はキーワードを引き継がずに開く。
 *
 * `/FindIssueAllOver.action` は台帳（docs/backlog-facts.md §1.1）で確認できているが、
 * キーワードを渡すクエリパラメータの名前は未確認。推測したパラメータを付けると、
 * 黙って無視された結果を「全件」と誤読させる。名前が実測できたら渡す。
 */
const EXTERNAL_SEARCH_PATH = '/FindIssueAllOver.action';

export function externalSearchUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${EXTERNAL_SEARCH_PATH}`;
}

function optionLabel(field: FilterField): string {
  return field.options.find((option) => option.id === field.value)?.label ?? field.value;
}

function isActive(field: FilterField): boolean {
  return field.neutralValue !== undefined && field.value !== field.neutralValue;
}

function suggestionId(field: FilterField): string {
  return `suggestion:${field.id}:${field.neutralValue ?? ''}`;
}

export function emptySuggestions(
  state: SearchState,
  ctx: SuggestionContext = {},
): readonly PanelSuggestion[] {
  const active = filterFields(state).filter(isActive);
  const conditions = active.filter((field) => field.id !== 'scope');

  const suggestions: PanelSuggestion[] = conditions.map((field) => ({
    id: suggestionId(field),
    group: 'condition',
    label: `${field.label}「${optionLabel(field)}」を外す`,
    sub: '条件をひとつ外して探し直します',
  }));

  if (conditions.length > 1) {
    suggestions.push({
      id: CLEAR_ALL,
      group: 'condition',
      label: '条件をすべて外す',
      sub: 'スコープはそのまま',
    });
  }

  const scope = active.find((field) => field.id === 'scope');
  if (scope !== undefined) {
    suggestions.push({
      id: suggestionId(scope),
      group: 'scope',
      label: '全スペースで探す',
      sub: '接続しているスペースをすべて見る',
    });
  }

  if (ctx.origin !== undefined) {
    suggestions.push({
      id: EXTERNAL,
      group: 'external',
      label: 'Backlog の課題検索を開く',
      sub: externalSearchUrl(ctx.origin),
    });
  }

  return suggestions;
}

export type SuggestionOutcome =
  | { kind: 'search'; state: SearchState }
  | { kind: 'open'; url: string };

/** 提案を選んだときに起きること。分からない id には何も起こさない */
export function applySuggestion(
  state: SearchState,
  id: string,
  ctx: SuggestionContext = {},
): SuggestionOutcome | undefined {
  if (id === CLEAR_ALL) return { kind: 'search', state: clearConditions(state) };
  if (id === EXTERNAL) {
    return ctx.origin === undefined
      ? undefined
      : { kind: 'open', url: externalSearchUrl(ctx.origin) };
  }

  const field = filterFields(state).find((candidate) => suggestionId(candidate) === id);
  if (field?.neutralValue === undefined) return undefined;

  return { kind: 'search', state: applyFilter(state, field.id, field.neutralValue, ctx) };
}
