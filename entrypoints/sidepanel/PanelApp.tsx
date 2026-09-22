import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { LabelsProvider } from '@/components/labels';
import { SidePanel } from '@/components/organisms/SidePanel';

import { backlog } from './backlog.ts';
import { panelCallbacks } from './callbacks.ts';
import type { PanelContext } from './context.ts';
import { usePanelFilters } from './filterSources.ts';
import { useHandoff } from './handoff.ts';
import { usePanelContext, useRecentQueries, useToast } from './hooks.ts';
import { rootRoute } from './route.ts';
import { type PanelSearch, panelSearchSchema } from './searchParams.ts';
import { usePanelSearch } from './usePanelSearch.ts';
import { buildPanelView } from './view.ts';

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

/** 入力・選択・トースト・URL の更新。パレットからの受け渡しは入力と URL の両方に写す */
function usePanelState(initialQuery: string) {
  const navigate = rootRoute.useNavigate();
  const [input, setInput] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string>();
  const [toast, showToast] = useToast();
  const update = useCallback(
    (next: PanelSearch) => void navigate({ to: '/', search: next }),
    [navigate],
  );
  useHandoff(
    useCallback(
      (next: PanelSearch) => {
        setInput(next.query);
        update(next);
      },
      [update],
    ),
  );
  return { input, setInput, selectedId, setSelectedId, toast, showToast, update };
}

function Panel({ context }: { context: PanelContext }) {
  // Register に載せていないので useSearch の型は付かない。スキーマで検証して型を得る
  const raw = panelSearchSchema.parse(rootRoute.useSearch());
  const search = useMemo(() => withDefaultScope(raw, context), [raw, context]);
  const { input, setInput, selectedId, setSelectedId, toast, showToast, update } = usePanelState(
    search.query,
  );
  const recentQueries = useRecentQueries(search.scope);
  const { session, state } = usePanelSearch(
    search,
    backlog.runner,
    selectedId,
    context.learningEnabled,
  );
  const { labels } = context;
  const filters = usePanelFilters(search, context);

  const view = buildPanelView({
    input,
    session,
    selectedId,
    recentQueries,
    filters,
    filtersActive: isFiltersActive(search, context.tabSpace),
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
      <SidePanel {...view} {...callbacks} />
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
