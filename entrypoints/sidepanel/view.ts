import type { Labels } from '@/components/labels';
import type {
  KeyHint,
  PanelView,
  RowView,
  SearchProgress,
  SectionView,
  ToastView,
} from '@/components/types';
import { deriveBindings, detectPlatform, toKeyHints } from '@/lib/keys';
import { externalSearchUrl } from '@/lib/nav';
import {
  errorOf,
  EXTERNAL_ROW_ID,
  isEmpty,
  NO_RESULTS_ROW_ID,
  type ResultRow,
  resultRowId,
  type SearchError,
  type SearchKind,
  searchKinds,
  type SearchSession,
  WIDEN_ROW_ID,
} from '@/lib/search';
import type { SearchScope } from '@/lib/share';

export const CLEAR_FILTERS_ROW_ID = 'command:clear-filters';

/** 結果行。パレットの検索結果と同じ並び・同じ見え方（surfaces.md §5.4） */
export function resultRowView(row: ResultRow, labels: Labels): RowView {
  const detail =
    row.kind === 'issue'
      ? row.assignee
      : row.updatedBy === undefined
        ? undefined
        : labels.rows.updatedBy(row.updatedBy);
  return {
    id: resultRowId(row),
    kind: row.kind,
    code: row.key,
    title: row.title,
    sub: [row.projectName, detail].filter((p) => p !== undefined).join(' · '),
    marker: row.status,
    tag: row.type,
    hints: ['enter', 'modEnter', 'complete'],
  };
}

function errorMessage(error: SearchError, labels: Labels): string {
  if (error.kind === 'rateLimited') return labels.rows.rateLimited('', error.retryAfterSeconds);
  return error.kind === 'unauthorized' ? labels.panel.authExpired : labels.rows.offline;
}

/** 種別ごとの進捗をステータス帯に（surfaces.md §5.2）。認証切れは帯の中に「再接続」 */
export function progressOf(session: SearchSession, labels: Labels): SearchProgress[] {
  return searchKinds.map((kind: SearchKind) => {
    const progress = session.kinds[kind];
    const label = labels.panel.options[kind];
    if (progress.state === 'ready')
      return { id: kind, label, state: 'ready', count: progress.count };
    if (progress.state === 'loading') return { id: kind, label, state: 'loading' };
    return {
      id: kind,
      label,
      state: 'error',
      message: errorMessage(progress.error, labels),
      action:
        progress.error.kind === 'unauthorized' ? { label: labels.panel.reconnect } : undefined,
    };
  });
}

/** 0 件の提案を組むのに要る文脈。スペース名は接続済みの一覧から、無ければホストのまま */
export type EmptyContext = {
  scope: SearchScope | undefined;
  spaceLabel: string;
  /** 種別・ステータス・担当者・更新日のどれかが効いている。スコープは含めない（外す行が別にある） */
  conditionsActive: boolean;
};

function emptyRows({ scope, spaceLabel, conditionsActive }: EmptyContext, labels: Labels) {
  const rows: RowView[] = [
    { id: NO_RESULTS_ROW_ID, kind: 'hint', title: labels.rows.noResults, hints: [] },
  ];
  if (conditionsActive)
    rows.push({
      id: CLEAR_FILTERS_ROW_ID,
      kind: 'command',
      title: labels.panel.clearFiltersRow,
      hints: ['enter'],
    });
  if (scope?.kind === 'project')
    rows.push({
      id: WIDEN_ROW_ID,
      kind: 'search',
      title: labels.rows.widenTo(spaceLabel),
      tone: 'accent',
      hints: ['enter'],
    });
  if (scope !== undefined)
    rows.push({
      id: EXTERNAL_ROW_ID,
      kind: 'external',
      title: labels.rows.openExternal,
      sub: labels.rows.openExternalSub(spaceLabel),
      hints: ['enter', 'modEnter'],
    });
  return rows;
}

/** 本体の課題検索ページ。語を渡すパラメータは台帳で未確認なので、ページだけ開く（lib/nav） */
export function externalUrlOf(scope: SearchScope): string {
  return externalSearchUrl({
    origin: `https://${scope.spaceId}`,
    ...(scope.kind === 'project' ? { projectKey: scope.projectId } : {}),
  });
}

/**
 * 0 件の提案は 条件を外す → プロジェクトを外す → 本体検索 の順（surfaces.md §5.4）。
 * 効いている条件を先頭に置くのは原因の切り分けのため
 */
export function sectionsOf(
  session: SearchSession | undefined,
  labels: Labels,
  empty: EmptyContext,
): SectionView[] {
  if (session === undefined) return [];
  if (isEmpty(session)) return [{ id: 'results', rows: emptyRows(empty, labels) }];
  return [{ id: 'results', rows: session.rows.map((row) => resultRowView(row, labels)) }];
}

/** 0 件の「一致なし」のように ↵ で何も起きない行は、既定の選択にしない */
function firstActionable(rows: readonly RowView[]): RowView | undefined {
  return rows.find((row) => row.hints.length > 0) ?? rows[0];
}

export function footerOf(
  sections: readonly SectionView[],
  selectedId: string | undefined,
  hasInput: boolean,
  hasResults: boolean,
  labels: Labels,
): KeyHint[] {
  const rows = sections.flatMap((section) => section.rows);
  const selected = rows.find((row) => row.id === selectedId) ?? firstActionable(rows);
  const bindings = deriveBindings(
    {
      selected,
      rowCount: rows.length,
      popLabel: undefined,
      hasInput,
      hasResults,
      panelAvailable: false,
    },
    labels,
  );
  return toKeyHints(bindings, detectPlatform());
}

export type ViewInput = {
  input: string;
  session: SearchSession | undefined;
  selectedId: string | undefined;
  recentQueries: readonly string[];
  filters: PanelView['filters'];
  empty: EmptyContext;
  toast: ToastView | undefined;
  labels: Labels;
};

export function buildPanelView(view: ViewInput): PanelView {
  const { session, labels } = view;
  const sections = sectionsOf(session, labels, view.empty);
  const rows = sections.flatMap((s) => s.rows);
  const selectedId = rows.some((row) => row.id === view.selectedId)
    ? view.selectedId
    : firstActionable(rows)?.id;
  const hasResults = session !== undefined && session.rows.length > 0;
  return {
    input: { value: view.input, placeholder: labels.panel.placeholder },
    recentQueries: view.recentQueries,
    filters: view.filters,
    progress: session === undefined ? [] : progressOf(session, labels),
    sections,
    selectedId,
    footer: footerOf(sections, selectedId, view.input.trim() !== '', hasResults, labels),
    toast: view.toast,
  };
}

/** 認証切れがあるか。帯の「再接続」の宛先を決めるのに使う */
export function needsReconnect(session: SearchSession | undefined): boolean {
  return session !== undefined && errorOf(session, 'unauthorized') !== undefined;
}
