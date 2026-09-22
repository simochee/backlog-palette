import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LabelsProvider } from '@/components/labels';
import { SidePanel } from '@/components/organisms/SidePanel';
import type { ToastView } from '@/components/types';
import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';
import { searchHistory } from '@/lib/storage/palette-items';
import { openPaletteInCurrentTab } from '@/lib/tabs';

import { backlog } from './backlog.ts';
import { panelCallbacks } from './callbacks.ts';
import { type PanelContext, readPanelContext, recentQueriesFor } from './context.ts';
import { buildFilters } from './filters.ts';
import { useFilterChoices } from './filterSources.ts';
import { useHandoff } from './handoff.ts';
import { useRememberSearch, useRestoreLastSearch } from './lastSearch.ts';
import { rootRoute } from './route.ts';
import { type PanelSearch, panelSearchSchema } from './searchParams.ts';
import { usePanelSearch } from './usePanelSearch.ts';
import { buildPanelView } from './view.ts';

const TOAST_LIFETIME_MS = 2000;

function usePanelContext(): PanelContext | undefined {
  const [context, setContext] = useState<PanelContext>();
  useEffect(() => {
    void readPanelContext().then(setContext);
  }, []);
  return context;
}

function useRecentQueries(scope: PanelSearch['scope']): string[] {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof searchHistory.getValue>>>([]);
  useEffect(() => {
    void searchHistory.getValue().then(setHistory);
    return searchHistory.watch((next) => {
      setHistory(next);
    });
  }, []);
  return useMemo(() => recentQueriesFor(history, scope), [history, scope]);
}

function useToast(): [ToastView | undefined, (toast: ToastView) => void] {
  const [toast, setToast] = useState<ToastView>();
  useEffect(() => {
    const timer =
      toast === undefined ? undefined : setTimeout(() => setToast(undefined), TOAST_LIFETIME_MS);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [toast]);
  return [toast, setToast];
}

function isConditionsActive(search: PanelSearch): boolean {
  const { type, status, assignee, updated } = search.conditions;
  return type !== 'all' || status.kind !== 'all' || assignee !== 'all' || updated !== 'any';
}

/** パネルの ⌘K はタブのパレットを開く（surfaces.md §5.4、P1）。パネル内のフォーカス移動には使わない */
function usePaletteHotkey() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || !isPaletteHotkey(event, navigator.platform)) return;
      event.preventDefault();
      void openPaletteInCurrentTab();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);
}

/** 既定のスコープはタブのスペース。URL に無ければ文脈から補う */
function withDefaultScope(search: PanelSearch, context: PanelContext): PanelSearch {
  if (search.scope !== undefined || context.tabSpace === undefined) return search;
  return { ...search, scope: { kind: 'space', spaceId: context.tabSpace } };
}

/** 入力・選択・トースト・URL の更新。パレットからの受け渡しと前回の復元は入力と URL の両方に写す */
function usePanelState(search: PanelSearch, tabSpace: string | undefined) {
  const navigate = rootRoute.useNavigate();
  const [input, setInput] = useState(search.query);
  const [selectedId, setSelectedId] = useState<string>();
  const [toast, showToast] = useToast();
  const [focusToken, setFocusToken] = useState(0);
  const update = useCallback(
    (next: PanelSearch) => void navigate({ to: '/', search: next }),
    [navigate],
  );
  const receive = useCallback(
    (next: PanelSearch) => {
      setInput(next.query);
      update(next);
    },
    [update],
  );
  useHandoff(
    useCallback(
      (next: PanelSearch) => {
        receive(next);
        setFocusToken(Date.now());
      },
      [receive],
    ),
  );
  useRestoreLastSearch(search, tabSpace, receive);
  useRememberSearch(search);
  return { input, setInput, selectedId, setSelectedId, toast, showToast, update, focusToken };
}

function Panel({ context }: { context: PanelContext }) {
  // Register に載せていないので useSearch の型は付かない。スキーマで検証して型を得る
  const raw = panelSearchSchema.parse(rootRoute.useSearch());
  const search = useMemo(() => withDefaultScope(raw, context), [raw, context]);
  const { input, setInput, selectedId, setSelectedId, toast, showToast, update, focusToken } =
    usePanelState(search, context.tabSpace);
  const recentQueries = useRecentQueries(search.scope);
  usePaletteHotkey();
  const { session, state } = usePanelSearch(
    search,
    backlog.runner,
    selectedId,
    context.learningEnabled,
  );
  const { labels } = context;
  const choices = useFilterChoices(search.scope, labels);

  const view = buildPanelView({
    input,
    session,
    selectedId,
    recentQueries,
    filters: buildFilters(search, labels, {
      spaces: context.spaces,
      tabSpace: context.tabSpace,
      ...choices,
    }),
    empty: {
      scope: search.scope,
      spaceLabel:
        context.spaces.find((space) => space.host === search.scope?.spaceId)?.name ??
        search.scope?.spaceId ??
        '',
      conditionsActive: isConditionsActive(search),
    },
    toast,
    labels,
  });
  const callbacks = panelCallbacks({
    search,
    session,
    labels,
    update,
    setInput,
    setSelectedId,
    showToast,
    currentState: state,
  });

  return (
    <LabelsProvider labels={labels}>
      <SidePanel {...view} {...callbacks} focusToken={focusToken} />
    </LabelsProvider>
  );
}

/** サイドパネルの container（surfaces.md §5）。状態は URL の検索状態と、この階層の useState だけ */
export function PanelApp() {
  const context = usePanelContext();
  if (context === undefined) return null;
  return (
    <QueryClientProvider client={backlog.queryClient}>
      <Panel context={context} />
    </QueryClientProvider>
  );
}
