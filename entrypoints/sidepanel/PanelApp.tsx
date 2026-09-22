import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { LabelsProvider } from '@/components/labels';
import { SidePanel } from '@/components/organisms/SidePanel';

import { backlog } from './backlog.ts';
import { panelCallbacks } from './callbacks.ts';
import type { PanelContext } from './context.ts';
import { usePanelFilters } from './filterSources.ts';
import { useHandoff } from './handoff.ts';
import { usePaletteHotkey, usePanelContext, useRecentQueries, useToast } from './hooks.ts';
import { useRememberSearch, useRestoreLastSearch } from './lastSearch.ts';
import { rootRoute } from './route.ts';
import { type PanelSearch, panelSearchSchema } from './searchParams.ts';
import { usePanelSearch } from './usePanelSearch.ts';
import { buildPanelView, type EmptyContext } from './view.ts';

function isConditionsActive(search: PanelSearch): boolean {
  const { type, status, assignee, updated } = search.conditions;
  return type !== 'all' || status.kind !== 'all' || assignee !== 'all' || updated !== 'any';
}

function emptyContextOf(search: PanelSearch, context: PanelContext): EmptyContext {
  const spaceId = search.scope?.spaceId;
  return {
    scope: search.scope,
    spaceLabel: context.spaces.find((space) => space.host === spaceId)?.name ?? spaceId ?? '',
    conditionsActive: isConditionsActive(search),
  };
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
  const update = (next: PanelSearch) => void navigate({ to: '/', search: next });
  const receive = (next: PanelSearch) => {
    setInput(next.query);
    update(next);
  };
  useHandoff((next: PanelSearch) => {
    receive(next);
    setFocusToken(Date.now());
  });
  useRestoreLastSearch(search, tabSpace, receive);
  useRememberSearch(search);
  return { input, setInput, selectedId, setSelectedId, toast, showToast, update, focusToken };
}

function Panel({ context }: { context: PanelContext }) {
  // Register に載せていないので useSearch の型は付かない。スキーマで検証して型を得る
  const raw = panelSearchSchema.parse(rootRoute.useSearch());
  const search = withDefaultScope(raw, context);
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
  const filters = usePanelFilters(search, context);

  const view = buildPanelView({
    input,
    session,
    selectedId,
    recentQueries,
    filters,
    empty: emptyContextOf(search, context),
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
