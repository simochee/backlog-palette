import type { Labels } from '@/components/labels';
import type { FilterField, PanelView, RowView, SectionView, SpaceProgress } from '@/components/types';

import { projects, spaces, statuses } from './domain';
import { deriveFooter } from './footer';
import { externalRow, hintRow, pageRow, sampleIssues, searchingRow, widenRow } from './rows';

type FilterOverrides = Partial<Record<'space' | 'project' | 'type' | 'status' | 'assignee' | 'updated', string>>;

const neutral = 'all';

function spaceField(labels: Labels, value: string): FilterField {
  return {
    id: 'space',
    label: labels.panel.fields.space,
    value,
    neutralValue: neutral,
    options: [
      { id: neutral, label: labels.panel.options.allSpaces },
      ...Object.values(spaces).map((space) => ({ id: space.id, label: space.label })),
    ],
  };
}

function projectField(labels: Labels, value: string): FilterField {
  return {
    id: 'project',
    label: labels.panel.fields.project,
    value,
    neutralValue: neutral,
    options: [
      { id: neutral, label: labels.panel.options.all },
      ...Object.values(projects).map((project) => ({ id: project.key, label: project.name })),
    ],
  };
}

function typeField(labels: Labels, value: string): FilterField {
  const { options } = labels.panel;
  return {
    id: 'type',
    label: labels.panel.fields.type,
    value,
    neutralValue: neutral,
    options: [
      { id: neutral, label: options.all },
      { id: 'issue', label: options.issue, count: 14 },
      { id: 'wiki', label: options.wiki, count: 2 },
      { id: 'document', label: options.document, count: 1 },
    ],
  };
}

function statusField(labels: Labels, value: string): FilterField {
  return {
    id: 'status',
    label: labels.panel.fields.status,
    value,
    neutralValue: neutral,
    options: [
      { id: neutral, label: labels.panel.options.all },
      { id: 'not-closed', label: labels.panel.options.notClosed },
      ...Object.entries(statuses).map(([id, status]) => ({ id, label: status.label, tone: status.tone })),
    ],
  };
}

function assigneeField(labels: Labels, value: string): FilterField {
  const { options } = labels.panel;
  return {
    id: 'assignee',
    label: labels.panel.fields.assignee,
    value,
    neutralValue: neutral,
    options: [
      { id: neutral, label: options.all },
      { id: 'me', label: options.me },
      { id: 'unassigned', label: options.unassigned },
    ],
  };
}

function updatedField(labels: Labels, value: string): FilterField {
  const { options } = labels.panel;
  return {
    id: 'updated',
    label: labels.panel.fields.updated,
    value,
    neutralValue: 'any',
    options: [
      { id: 'any', label: options.anyTime },
      { id: 'week', label: options.week },
      { id: 'month', label: options.month },
      { id: 'quarter', label: options.quarter },
    ],
  };
}

export function filters(labels: Labels, values: FilterOverrides = {}): FilterField[] {
  return [
    spaceField(labels, values.space ?? neutral),
    projectField(labels, values.project ?? neutral),
    typeField(labels, values.type ?? neutral),
    statusField(labels, values.status ?? neutral),
    assigneeField(labels, values.assignee ?? neutral),
    updatedField(labels, values.updated ?? 'any'),
  ];
}

export const recentQueries = ['決済', 'リリース手順', 'ログイン'];

export const allReady: SpaceProgress[] = [
  { id: spaces.nulab.id, label: spaces.nulab.label, state: 'ready', count: 12 },
  { id: spaces.acme.id, label: spaces.acme.label, state: 'ready', count: 4 },
  { id: spaces.beta.id, label: spaces.beta.label, state: 'ready', count: 1 },
];

export const mixedProgress = (labels: Labels): SpaceProgress[] => [
  { id: spaces.nulab.id, label: spaces.nulab.label, state: 'ready', count: 12 },
  { id: spaces.acme.id, label: spaces.acme.label, state: 'loading' },
  {
    id: spaces.beta.id,
    label: spaces.beta.label,
    state: 'error',
    message: labels.panel.authExpired,
    action: { label: labels.panel.reconnect },
  },
];

const crossSpace = (row: RowView, space: string): RowView => ({ ...row, space: { label: space } });

export const paymentResults = (labels: Labels): RowView[] => [
  crossSpace(sampleIssues.payment, spaces.nulab.label),
  crossSpace(sampleIssues.password, spaces.nulab.label),
  crossSpace(sampleIssues.invoice, spaces.acme.label),
  crossSpace(pageRow('billing', '請求設定', labels, projects.web, `スペース設定 · ${labels.rows.pageSub}`), spaces.nulab.label),
  {
    id: 'wiki:payment-spec',
    kind: 'wiki',
    title: '決済まわりの仕様メモ',
    sub: `${projects.web.name} · 最終更新 田中 拓也`,
    space: { label: spaces.nulab.label },
    hints: ['enter', 'modEnter', 'complete'],
  },
];

type PanelPartial = {
  input?: string;
  filters?: FilterField[];
  spaces?: SpaceProgress[];
  sections?: SectionView[];
  selectedId?: string;
  hasResults?: boolean;
  recent?: string[];
};

function panel(labels: Labels, partial: PanelPartial): PanelView {
  const input = partial.input ?? '';
  const sections = partial.sections ?? [];
  const selectedId = partial.selectedId ?? sections[0]?.rows[0]?.id;
  return {
    input: { value: input, placeholder: labels.panel.placeholder },
    recentQueries: partial.recent ?? recentQueries,
    filters: partial.filters ?? filters(labels),
    spaces: partial.spaces ?? [],
    sections,
    selectedId,
    footer: deriveFooter(labels, {
      path: [],
      input: '',
      sections,
      selectedId,
      hasResults: partial.hasResults,
    }),
  };
}

/** P1 初期（前回の語と最近の検索） */
export const p1 = (labels: Labels): PanelView => panel(labels, {});

/** P2 結果あり */
export const p2 = (labels: Labels): PanelView =>
  panel(labels, {
    input: '決済',
    filters: filters(labels, { type: 'issue' }),
    spaces: allReady,
    hasResults: true,
    sections: [{ id: 'results', rows: paymentResults(labels) }],
  });

/** P3 スペース単位の逐次到着 */
export const p3 = (labels: Labels): PanelView =>
  panel(labels, {
    input: '決済',
    spaces: mixedProgress(labels),
    hasResults: true,
    sections: [
      {
        id: 'results',
        rows: paymentResults(labels).filter((row) => row.space?.label === spaces.nulab.label),
      },
    ],
  });

/** P4 0 件 */
export const p4 = (labels: Labels): PanelView =>
  panel(labels, {
    input: '決済',
    filters: filters(labels, { space: spaces.nulab.id, status: 'not-closed' }),
    spaces: [{ id: spaces.nulab.id, label: spaces.nulab.label, state: 'ready', count: 0 }],
    hasResults: true,
    selectedId: 'command:clear-filters',
    sections: [
      {
        id: 'results',
        rows: [
          hintRow('no-results', labels.rows.noResults),
          { id: 'command:clear-filters', kind: 'command', title: labels.panel.clearFiltersRow, hints: ['enter'] },
          widenRow(labels.palette.rootScope, labels),
          externalRow(labels),
        ],
      },
    ],
  });

/** P5 フィルター変更直後 */
export const p5 = (labels: Labels): PanelView =>
  panel(labels, {
    input: '決済',
    filters: filters(labels, { status: 'not-closed' }),
    spaces: allReady.map((space) => ({ id: space.id, label: space.label, state: 'loading' })),
    hasResults: true,
    sections: [{ id: 'results', label: labels.sections.results, rows: [searchingRow(labels)] }],
  });
