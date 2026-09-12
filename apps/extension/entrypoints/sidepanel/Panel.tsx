import { buildShareUrl, defaultSearchState, type SearchState } from '@backlog-palette/core';
import { type PaletteSection, type PanelEmptyState, PanelSurface } from '@backlog-palette/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from '../../src/hooks/useSearch.ts';
import { sendMessage } from '../../src/messaging/ext.ts';
import type { PageContext } from '../../src/messaging/window.ts';
import { applyFilter, filterFields } from '../../src/panel/filters.ts';
import { previewFor } from '../../src/panel/preview.ts';
import { applySuggestion, emptySuggestions } from '../../src/panel/suggestions.ts';

const HISTORY_PREFIX = 'history:';
const TOAST_MS = 4000;
/** 履歴は全部は出さない。空入力の画面は「次に何を打つか」の助けで、一覧ではない */
const HISTORY_ROWS = 8;

function historySections(history: readonly string[]): readonly PaletteSection[] {
  if (history.length === 0) return [];

  return [
    {
      id: 'history',
      label: '最近の検索',
      rows: history.slice(0, HISTORY_ROWS).map((query, index) => ({
        id: `${HISTORY_PREFIX}${query}`,
        kind: 'filter' as const,
        title: query,
        hint: index === 0 ? ('enter' as const) : ('none' as const),
      })),
    },
  ];
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
  const [history, setHistory] = useState<readonly string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; detail: string } | undefined>(undefined);
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

    sendMessage('searchHistory')
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  const [searched, setSearched] = useState('');

  const run = useCallback(
    (next: SearchState) => {
      setState(next);
      if (next.query.trim() === '') return;

      setSearched(next.query);
      setHighlightedId(undefined);
      search.start(next);

      sendMessage('rememberSearch', next.query)
        .then(setHistory)
        .catch(() => undefined);
    },
    [search],
  );

  const filterContext = useMemo(
    () => (ctx?.spaceKey === undefined ? {} : { currentSpaceKey: ctx.spaceKey }),
    [ctx?.spaceKey],
  );

  const suggestionContext = useMemo(
    () => ({ ...filterContext, ...(ctx?.origin === undefined ? {} : { origin: ctx.origin }) }),
    [filterContext, ctx?.origin],
  );

  const shareUrl = useCallback(
    () => (ctx === undefined ? undefined : buildShareUrl(ctx.origin, { ...state, query })),
    [ctx, state, query],
  );

  const latestQuery = history[0];
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /*
   * キーは捕捉段階で受ける。React Aria が先に受け取ると、入力が空のときの `↑` が
   * 候補リストの選択移動に消費されて、直前のクエリまで届かない。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      const inInput = event.target instanceof HTMLInputElement;

      if (event.key === 'ArrowUp' && inInput && query === '' && latestQuery !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        setQuery(latestQuery);
        return;
      }

      const isCopy = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'C';
      const url = isCopy ? shareUrl() : undefined;
      if (url === undefined) return;

      event.preventDefault();
      navigator.clipboard
        .writeText(url)
        .then(() => {
          clearTimeout(toastTimer.current);
          // 何をコピーしたかは URL の実体で見せる（モック B5）
          setToast({ message: '検索 URL をコピーしました', detail: url });
          toastTimer.current = setTimeout(() => setToast(undefined), TOAST_MS);
        })
        .catch(() => undefined);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [query, latestQuery, shareUrl]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const rows = search.results.rows;
  const showHistory = query.trim() === '';

  const sections = useMemo<readonly PaletteSection[]>(
    () =>
      showHistory
        ? historySections(history)
        : [{ id: 'results', rows: rows.map((row) => ({ ...row })) }],
    [showHistory, history, rows],
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

  /*
   * プレビューは選択行に追従する。まだ何も動かしていないときは先頭行を出す。
   * 空のペインから始めると、↓ を押すまで「開かずに読める」ことに気づけない。
   */
  const previewRow = rows.find((row) => row.id === highlightedId) ?? rows[0];
  const preview =
    showHistory || previewRow === undefined ? undefined : previewFor(previewRow, searched);

  const onHighlight = useCallback(
    (id: string) => {
      setHighlightedId(id);
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) search.setSelectedIndex(index);
    },
    [rows, search],
  );

  const emptyState: PanelEmptyState | undefined =
    showHistory || search.running || rows.length > 0 || searched === ''
      ? undefined
      : {
          title: `「${searched}」に一致する結果がありません`,
          description: '条件かスコープのどちらが効いているかで切り分けます',
          suggestions: emptySuggestions(state, suggestionContext),
        };

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
        onFilterChange={(fieldId, optionId) =>
          run(applyFilter(state, fieldId, optionId, filterContext))
        }
        onFilterClear={() => run({ ...defaultSearchState, query: state.query })}
        spaces={spaces}
        {...(held > 0 ? { statusSummary: `${held} 件の新しい結果 — ↑ で先頭へ` } : {})}
        sections={sections}
        {...(previewRow === undefined || showHistory ? {} : { selectedId: previewRow.id })}
        {...(preview === undefined ? {} : { preview })}
        onHighlight={onHighlight}
        {...(emptyState === undefined ? {} : { emptyState })}
        onSuggestion={(id) => {
          const outcome = applySuggestion(state, id, suggestionContext);
          if (outcome === undefined) return;

          if (outcome.kind === 'search') {
            run(outcome.state);
            return;
          }

          void sendMessage('navigate', { url: outcome.url, target: 'newTab' }).catch(
            () => undefined,
          );
        }}
        {...(toast === undefined ? {} : { toast })}
        footer={[
          { keys: ['↑', '↓'], label: '移動' },
          { keys: ['↵'], label: '開く' },
          { keys: ['⌘', '⇧', 'C'], label: '検索 URL をコピー' },
        ]}
        onAction={(id) => {
          if (id.startsWith(HISTORY_PREFIX)) {
            const recalled = id.slice(HISTORY_PREFIX.length);
            setQuery(recalled);
            run({ ...state, query: recalled });
            return;
          }

          const row = rows.find((candidate) => candidate.id === id);
          if (row === undefined) return;

          setHighlightedId(id);
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
