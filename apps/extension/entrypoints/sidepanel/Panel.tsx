import {
  buildShareUrl,
  defaultSearchState,
  type SearchResultType,
  type SearchState,
} from '@backlog-palette/core';
import { type FilterField, PanelSurface } from '@backlog-palette/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendMessage } from '../../src/messaging/ext.ts';
import type { PageContext } from '../../src/messaging/window.ts';
import { useSearch } from './useSearch.ts';

const TYPE_SETS: Record<string, readonly SearchResultType[]> = {
  all: ['issue', 'wiki', 'document'],
  issue: ['issue'],
  wiki: ['wiki'],
  document: ['document'],
};

function filterFields(state: SearchState): FilterField[] {
  const typeId =
    Object.entries(TYPE_SETS).find(
      ([, types]) =>
        types.length === state.types.length && types.every((t) => state.types.includes(t)),
    )?.[0] ?? 'all';

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
      value: typeId,
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

function applyFilter(state: SearchState, fieldId: string, optionId: string): SearchState {
  switch (fieldId) {
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

/**
 * 「探す」サーフェス。結果が残り、条件を変えながら絞り込む（実装プラン §5.3）。
 *
 * 検索は Enter で明示的に実行する。打鍵ごとに投げるとレート枠を食い潰す（§7.4）。
 */
export function Panel() {
  const [ctx, setCtx] = useState<PageContext | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>(defaultSearchState);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const search = useSearch(ctx?.spaceKey);

  useEffect(() => {
    sendMessage('getActiveContext')
      .then((active) => {
        setCtx(active);
        if (active?.spaceKey !== undefined) {
          setState((current) => ({
            ...current,
            scope: { kind: 'space', spaceKey: active.spaceKey ?? '' },
          }));
        }
      })
      .catch(() => undefined);
  }, []);

  const [searched, setSearched] = useState('');

  const run = useCallback(
    (next: SearchState) => {
      setState(next);
      if (next.query.trim() === '') return;

      setSearched(next.query);
      search.start(next);
    },
    [search],
  );

  /*
   * 検索状態を URL にして配る（§7.5）。フラグメントに載せるのでサーバーには
   * 送られず、拡張を入れていない相手にも普通の Backlog ページとして開ける。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCopy = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'C';
      if (!isCopy || ctx === undefined) return;

      event.preventDefault();
      navigator.clipboard
        .writeText(buildShareUrl(ctx.origin, { ...state, query }))
        .then(() => setToast('検索 URL をコピーしました'))
        .catch(() => undefined);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ctx, state, query]);

  const sections = useMemo(
    () => [{ id: 'results', rows: search.results.rows.map((row) => ({ ...row })) }],
    [search.results.rows],
  );

  const spaces = useMemo(
    () =>
      search.spaces.map((space) => ({
        id: space.spaceKey,
        label: space.spaceKey,
        state: space.state,
        ...(space.count === undefined ? {} : { count: space.count }),
        ...(space.message === undefined ? {} : { message: space.message }),
      })),
    [search.spaces],
  );

  const held = search.results.held.length;

  return (
    <div
      data-bp-theme=""
      data-bp-scheme={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}
      style={{ height: '100%' }}
    >
      <PanelSurface
        value={query}
        placeholder="課題・Wiki・ドキュメントを検索"
        onValueChange={setQuery}
        submitOnEnter={query !== searched}
        onSubmit={(value) => run({ ...state, query: value })}
        filters={filterFields(state)}
        onFilterChange={(fieldId, optionId) => run(applyFilter(state, fieldId, optionId))}
        onFilterClear={() => run({ ...defaultSearchState, query: state.query })}
        spaces={spaces}
        {...(held > 0 ? { statusSummary: `${held} 件の新しい結果 — ↑ で先頭へ` } : {})}
        sections={sections}
        {...(selectedId === undefined ? {} : { selectedId })}
        {...(toast === undefined ? {} : { toast: { message: toast } })}
        footer={[
          { keys: ['↑', '↓'], label: '移動' },
          { keys: ['↵'], label: '開く' },
          { keys: ['⌘', '⇧', 'C'], label: '検索 URL をコピー' },
        ]}
        onAction={(id) => {
          const row = search.results.rows.find((candidate) => candidate.id === id);
          if (row === undefined) return;

          setSelectedId(id);
          void sendMessage('runRowAction', {
            kind: 'navigate',
            url: row.url,
            target: 'currentTab',
          }).catch(() => undefined);
        }}
        onEscape={() => {
          setQuery('');
        }}
        autoFocus
      />
    </div>
  );
}
