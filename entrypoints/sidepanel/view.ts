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
import {
  errorOf,
  isEmpty,
  NO_RESULTS_ROW_ID,
  type ResultRow,
  resultRowId,
  type SearchError,
  type SearchKind,
  searchKinds,
  type SearchSession,
} from '@/lib/search';

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

/** 0 件の提案は 条件を外す → （プロジェクトを外す）→ 本体検索 の順（surfaces.md §5.4）。本体検索は M6 後半 */
export function sectionsOf(
  session: SearchSession | undefined,
  labels: Labels,
  filtersActive: boolean,
): SectionView[] {
  if (session === undefined) return [];
  if (isEmpty(session)) {
    const rows: RowView[] = [
      { id: NO_RESULTS_ROW_ID, kind: 'hint', title: labels.rows.noResults, hints: [] },
    ];
    if (filtersActive)
      rows.push({
        id: CLEAR_FILTERS_ROW_ID,
        kind: 'command',
        title: labels.panel.clearFiltersRow,
        hints: ['enter'],
        tone: 'accent',
      });
    return [{ id: 'results', rows }];
  }
  return [{ id: 'results', rows: session.rows.map((row) => resultRowView(row, labels)) }];
}

export function footerOf(
  sections: readonly SectionView[],
  selectedId: string | undefined,
  hasInput: boolean,
  hasResults: boolean,
  labels: Labels,
): KeyHint[] {
  const rows = sections.flatMap((section) => section.rows);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
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
  filtersActive: boolean;
  toast: ToastView | undefined;
  labels: Labels;
};

export function buildPanelView(view: ViewInput): PanelView {
  const { session, labels } = view;
  const sections = sectionsOf(session, labels, view.filtersActive);
  const rows = sections.flatMap((s) => s.rows);
  const selectedId = rows.some((row) => row.id === view.selectedId) ? view.selectedId : rows[0]?.id;
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
