import { useEffect, useMemo, useState } from 'react';

import { LabelsProvider } from '@/components/labels';
import { SidePanel } from '@/components/organisms/SidePanel';
import type { ToastView } from '@/components/types';
import { searchHistory } from '@/lib/storage/palette-items';

import { panelCallbacks } from './callbacks.ts';
import { type PanelContext, readPanelContext, recentQueriesFor } from './context.ts';
import { buildFilters } from './filters.ts';
import { rootRoute } from './route.ts';
import { emptyPanelRunner } from './runner.ts';
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

function isFiltersActive(search: PanelSearch, tabSpace: string | undefined): boolean {
  const { type, status, assignee, updated } = search.conditions;
  const scopeChanged =
    search.scope !== undefined &&
    (search.scope.kind === 'project' || search.scope.spaceId !== tabSpace);
  return (
    scopeChanged ||
    type !== 'all' ||
    status.kind !== 'all' ||
    assignee !== 'all' ||
    updated !== 'any'
  );
}

/** 既定のスコープはタブのスペース。URL に無ければ文脈から補う */
function withDefaultScope(search: PanelSearch, context: PanelContext): PanelSearch {
  if (search.scope !== undefined || context.tabSpace === undefined) return search;
  return { ...search, scope: { kind: 'space', spaceId: context.tabSpace } };
}

function Panel({ context }: { context: PanelContext }) {
  // Register に載せていないので useSearch の型は付かない。スキーマで検証して型を得る
  const raw = panelSearchSchema.parse(rootRoute.useSearch());
  const navigate = rootRoute.useNavigate();
  const search = useMemo(() => withDefaultScope(raw, context), [raw, context]);
  const [input, setInput] = useState(search.query);
  const [selectedId, setSelectedId] = useState<string>();
  const [toast, showToast] = useToast();
  const recentQueries = useRecentQueries(search.scope);
  const { session, state } = usePanelSearch(
    search,
    emptyPanelRunner,
    selectedId,
    context.learningEnabled,
  );
  const { labels } = context;

  const view = buildPanelView({
    input,
    session,
    selectedId,
    recentQueries,
    filters: buildFilters(search, labels, {
      spaces: context.spaces,
      tabSpace: context.tabSpace,
      projects: [],
      statuses: [],
    }),
    filtersActive: isFiltersActive(search, context.tabSpace),
    toast,
    labels,
  });
  const callbacks = panelCallbacks({
    search,
    session,
    labels,
    update: (next) => void navigate({ to: '/', search: next }),
    setInput,
    setSelectedId,
    showToast,
    currentState: state,
  });

  return (
    <LabelsProvider labels={labels}>
      <SidePanel {...view} {...callbacks} />
    </LabelsProvider>
  );
}

/** サイドパネルの container（surfaces.md §5）。状態は URL の検索状態と、この階層の useState だけ */
export function PanelApp() {
  const context = usePanelContext();
  if (context === undefined) return null;
  return <Panel context={context} />;
}
