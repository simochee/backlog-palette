import { defaultSearchState, type SearchResultType, type SearchState } from '@backlog-palette/core';
import type { FilterField } from '@backlog-palette/ui';

/**
 * 常設フィルターバーの項目と、選択を `SearchState` へ戻す規則（実装プラン §3 D5）。
 *
 * 条件はすべて AND・各条件は単一選択。0 件のときの提案（§13 の B4）も
 * この一覧から作るので、「どの条件が効いているか」の判断はここに 1 つだけ置く。
 */

export const TYPE_SETS: Record<string, readonly SearchResultType[]> = {
  all: ['issue', 'wiki', 'document'],
  issue: ['issue'],
  wiki: ['wiki'],
  document: ['document'],
};

export type FilterContext = {
  /** 「このスペース」を選べるのは、いま Backlog のタブを見ているときだけ */
  currentSpaceKey?: string;
};

function typeId(state: SearchState): string {
  return (
    Object.entries(TYPE_SETS).find(
      ([, types]) =>
        types.length === state.types.length && types.every((t) => state.types.includes(t)),
    )?.[0] ?? 'all'
  );
}

export function filterFields(state: SearchState): readonly FilterField[] {
  return [
    {
      id: 'scope',
      label: 'スペース',
      value: state.scope.kind === 'allSpaces' ? 'all' : 'current',
      neutralValue: 'all',
      options: [
        { id: 'all', label: '全スペース' },
        { id: 'current', label: 'このスペース' },
      ],
    },
    {
      id: 'type',
      label: '種別',
      value: typeId(state),
      neutralValue: 'all',
      options: [
        { id: 'all', label: 'すべて' },
        { id: 'issue', label: '課題' },
        { id: 'wiki', label: 'Wiki' },
        { id: 'document', label: 'ドキュメント' },
      ],
    },
    {
      id: 'status',
      label: 'ステータス',
      value: state.status.kind === 'preset' ? 'openOnly' : 'any',
      neutralValue: 'any',
      options: [
        { id: 'any', label: 'すべて' },
        { id: 'openOnly', label: '完了を除く' },
      ],
    },
    {
      id: 'assignee',
      label: '担当者',
      value: state.assignee.kind === 'me' ? 'me' : 'any',
      neutralValue: 'any',
      options: [
        { id: 'any', label: 'すべて' },
        { id: 'me', label: '自分' },
      ],
    },
    {
      id: 'updated',
      label: '更新日',
      value: state.updated.kind === 'withinDays' ? String(state.updated.days) : 'any',
      neutralValue: 'any',
      options: [
        { id: 'any', label: 'すべて' },
        { id: '7', label: '7 日以内' },
        { id: '30', label: '30 日以内' },
      ],
    },
  ];
}

function scopeOf(state: SearchState, optionId: string, ctx: FilterContext): SearchState['scope'] {
  if (optionId === 'all') return { kind: 'allSpaces' };

  const spaceKey =
    ctx.currentSpaceKey ?? (state.scope.kind === 'allSpaces' ? undefined : state.scope.spaceKey);
  return spaceKey === undefined ? state.scope : { kind: 'space', spaceKey };
}

export function applyFilter(
  state: SearchState,
  fieldId: string,
  optionId: string,
  ctx: FilterContext = {},
): SearchState {
  switch (fieldId) {
    case 'scope':
      return { ...state, scope: scopeOf(state, optionId, ctx) };
    case 'type':
      return { ...state, types: TYPE_SETS[optionId] ?? TYPE_SETS.all ?? [] };
    case 'status':
      return {
        ...state,
        status: optionId === 'openOnly' ? { kind: 'preset', preset: 'openOnly' } : { kind: 'any' },
      };
    case 'assignee':
      return { ...state, assignee: optionId === 'me' ? { kind: 'me' } : { kind: 'any' } };
    case 'updated':
      return {
        ...state,
        updated:
          optionId === 'any' ? { kind: 'any' } : { kind: 'withinDays', days: Number(optionId) },
      };
    default:
      return state;
  }
}

/** スコープは条件ではない（§13 の切り分け）。まとめて外してもスコープは動かさない */
export function clearConditions(state: SearchState): SearchState {
  return { ...defaultSearchState, query: state.query, scope: state.scope };
}
