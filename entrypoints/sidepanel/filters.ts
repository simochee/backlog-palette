import type { Labels } from '@/components/labels';
import type { FilterField } from '@/components/types';
import type { ProjectRef } from '@/lib/backlog/entries';
import type { StatusRecord } from '@/lib/backlog/queries';
import { isBuiltinStatus } from '@/lib/backlog/statuses';
import type { ConnectedSpace } from '@/lib/connect/connectSpace';
import type { SearchScope } from '@/lib/share';

import type { PanelSearch } from './searchParams.ts';

const ALL = 'all';
const NOT_CLOSED = 'not-closed';
const STATUS_PREFIX = 'status:';

export type FilterSources = {
  spaces: readonly ConnectedSpace[];
  /** 既定のスペース（タブのスペース）。ここから変えたときだけ効いている扱い（D-20） */
  tabSpace: string | undefined;
  projects: readonly { id: string; label: string }[];
  statuses: readonly { id: number; label: string }[];
};

type Choice<T> = { id: T; label: string };

/** プロジェクトの id は projectKey（entrypoints/palette/context.ts の約束） */
export function projectChoices(projects: readonly ProjectRef[]): Choice<string>[] {
  return projects.map((project) => ({ id: project.projectKey, label: project.name }));
}

/**
 * プロジェクトを選んでいればそのプロジェクトのステータス、「すべて」なら組み込み 4 種だけ
 * （surfaces.md §5.3）。カスタムステータスはプロジェクトごとに ID が違い、横断では指せない
 */
export function statusChoices(
  projectStatuses: readonly StatusRecord[] | undefined,
  labels: Labels,
): Choice<number>[] {
  if (projectStatuses !== undefined)
    return projectStatuses
      .toSorted((a, b) => a.displayOrder - b.displayOrder)
      .map((status) => ({ id: status.id, label: status.name }));
  const { options } = labels.panel;
  return [
    { id: 1, label: options.statusOpen },
    { id: 2, label: options.statusInProgress },
    { id: 3, label: options.statusResolved },
    { id: 4, label: options.statusClosed },
  ];
}

function statusValue(search: PanelSearch): string {
  const { status } = search.conditions;
  if (status.kind === 'all') return ALL;
  if (status.kind === 'notClosed') return NOT_CLOSED;
  return `${STATUS_PREFIX}${status.statusId}`;
}

type Src = { search: PanelSearch; labels: Labels; sources: FilterSources };

function spaceField({ search, labels, sources }: Src): FilterField {
  return {
    id: 'space',
    label: labels.panel.fields.space,
    value: search.scope?.spaceId ?? sources.tabSpace ?? '',
    neutralValue: sources.tabSpace,
    options: sources.spaces.map((space) => ({ id: space.host, label: space.name })),
  };
}

function projectField({ search, labels, sources }: Src): FilterField {
  return {
    id: 'project',
    label: labels.panel.fields.project,
    value: search.scope?.kind === 'project' ? search.scope.projectId : ALL,
    neutralValue: ALL,
    options: [{ id: ALL, label: labels.panel.options.all }, ...sources.projects],
  };
}

function typeField({ search, labels }: Src): FilterField {
  const { options } = labels.panel;
  return {
    id: 'type',
    label: labels.panel.fields.type,
    value: search.conditions.type,
    neutralValue: ALL,
    options: [
      { id: ALL, label: options.all },
      { id: 'issue', label: options.issue },
      { id: 'wiki', label: options.wiki },
      { id: 'document', label: options.document },
    ],
  };
}

function statusField({ search, labels, sources }: Src): FilterField {
  return {
    id: 'status',
    label: labels.panel.fields.status,
    value: statusValue(search),
    neutralValue: ALL,
    options: [
      { id: ALL, label: labels.panel.options.all },
      { id: NOT_CLOSED, label: labels.panel.options.notClosed },
      ...sources.statuses.map((s) => ({ id: `${STATUS_PREFIX}${s.id}`, label: s.label })),
    ],
  };
}

function assigneeField({ search, labels }: Src): FilterField {
  const { options } = labels.panel;
  return {
    id: 'assignee',
    label: labels.panel.fields.assignee,
    value: search.conditions.assignee,
    neutralValue: ALL,
    options: [
      { id: ALL, label: options.all },
      { id: 'me', label: options.me },
      { id: 'unassigned', label: options.unassigned },
    ],
  };
}

function updatedField({ search, labels }: Src): FilterField {
  const { options } = labels.panel;
  return {
    id: 'updated',
    label: labels.panel.fields.updated,
    value: search.conditions.updated,
    neutralValue: 'any',
    options: [
      { id: 'any', label: options.anyTime },
      { id: 'week', label: options.week },
      { id: 'month', label: options.month },
      { id: 'quarter', label: options.quarter },
    ],
  };
}

/** フィルターバーの 6 項目（surfaces.md §5.3）。値は URL の検索状態から、選択肢は文脈から */
export function buildFilters(
  search: PanelSearch,
  labels: Labels,
  sources: FilterSources,
): FilterField[] {
  const src: Src = { search, labels, sources };
  return [
    spaceField(src),
    projectField(src),
    typeField(src),
    statusField(src),
    assigneeField(src),
    updatedField(src),
  ];
}

function scopeAfter(scope: SearchScope | undefined, fieldId: string, optionId: string) {
  if (fieldId === 'space') return { kind: 'space', spaceId: optionId } as const;
  if (fieldId === 'project' && scope !== undefined)
    return optionId === ALL
      ? ({ kind: 'space', spaceId: scope.spaceId } as const)
      : ({ kind: 'project', spaceId: scope.spaceId, projectId: optionId } as const);
  return scope;
}

function statusAfter(optionId: string): PanelSearch['conditions']['status'] {
  if (optionId === NOT_CLOSED) return { kind: 'notClosed' };
  const id = Number(optionId.slice(STATUS_PREFIX.length));
  return optionId.startsWith(STATUS_PREFIX) && Number.isInteger(id)
    ? { kind: 'status', statusId: id }
    : { kind: 'all' };
}

type Conditions = PanelSearch['conditions'];

function oneOf<T extends string>(values: readonly T[]) {
  return (value: string): value is T => (values as readonly string[]).includes(value);
}
const isType = oneOf<Conditions['type']>(['all', 'issue', 'wiki', 'document']);
const isAssignee = oneOf<Conditions['assignee']>(['all', 'me', 'unassigned']);
const isUpdated = oneOf<Conditions['updated']>(['any', 'week', 'month', 'quarter']);

/** カスタムステータスは選んだプロジェクトでしか通じない。スコープが変わったら外す */
function statusAcross(status: Conditions['status']): Conditions['status'] {
  return status.kind === 'status' && !isBuiltinStatus(status.statusId) ? { kind: 'all' } : status;
}

/** 1 項目の変更を検索状態に写す。条件はすべて AND、各条件は単一選択 */
export function applyFilter(search: PanelSearch, fieldId: string, optionId: string): PanelSearch {
  const { conditions } = search;
  switch (fieldId) {
    case 'space':
    case 'project':
      return {
        ...search,
        scope: scopeAfter(search.scope, fieldId, optionId),
        conditions: { ...conditions, status: statusAcross(conditions.status) },
      };
    case 'type':
      return isType(optionId)
        ? { ...search, conditions: { ...conditions, type: optionId } }
        : search;
    case 'status':
      return { ...search, conditions: { ...conditions, status: statusAfter(optionId) } };
    case 'assignee':
      return isAssignee(optionId)
        ? { ...search, conditions: { ...conditions, assignee: optionId } }
        : search;
    case 'updated':
      return isUpdated(optionId)
        ? { ...search, conditions: { ...conditions, updated: optionId } }
        : search;
    default:
      return search;
  }
}

/** 0 件の「プロジェクトを外す」。フィルターバーでプロジェクトを「すべて」に戻すのと同じ */
export function removeProject(search: PanelSearch): PanelSearch {
  return applyFilter(search, 'project', ALL);
}

/** 「条件をすべて外す」。スコープ（スペース・プロジェクト）は外さない（surfaces.md §5.3） */
export function clearConditions(search: PanelSearch): PanelSearch {
  return {
    ...search,
    conditions: { type: 'all', status: { kind: 'all' }, assignee: 'all', updated: 'any' },
  };
}
