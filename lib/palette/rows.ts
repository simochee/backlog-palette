import type { Labels } from '@/components/labels';
import type { RowHint, RowView } from '@/components/types';
import type { CommandSegment, Scope } from '@/lib/stack/types';

import type { CachedEntry, PageEntry, ProjectEntry, SpaceEntry } from './model';
import type { TakeTarget } from './state';

/** 行の ↵ で起きること。container はこれを見て遷移・検索・コピーを実行する */
export type RowAction =
  | { type: 'navigate'; url: string }
  | { type: 'search'; query: string; scope: Scope }
  | { type: 'copy'; text: string; subject: string }
  | { type: 'descend'; command: CommandSegment }
  | { type: 'connect'; spaceId: string | undefined };

export type Built = {
  row: RowView;
  action?: RowAction;
  take?: TakeTarget;
};

/**
 * hints は動作から導く（不変条件 I1）。action があれば ↵、遷移なら ⌘↵、take の種類で
 * ⇥ の意味が決まる。文字列で hints を渡す経路は無い。
 */
function hintsOf(action: RowAction | undefined, take: TakeTarget | undefined): RowHint[] {
  const hints: RowHint[] = [];
  if (action !== undefined) hints.push(action.type === 'descend' ? 'descend' : 'enter');
  if (action?.type === 'navigate') hints.push('modEnter');
  if (take !== undefined) hints.push(take.kind === 'complete' ? 'complete' : 'stack');
  return hints;
}

type RowInput = Omit<RowView, 'hints' | 'id'>;

export function build(id: string, input: RowInput, action?: RowAction, take?: TakeTarget): Built {
  const row: RowView = { ...input, id, hints: hintsOf(action, take) };
  return { row, action, take };
}

export function pageRow(section: string, page: PageEntry, sub: string): Built {
  return build(
    `${section}:page:${page.id}`,
    { kind: 'page', title: page.title, sub },
    { type: 'navigate', url: page.url },
    { kind: 'complete', text: page.title },
  );
}

function entitySub(entry: CachedEntry, labels: Labels): string {
  const detail =
    entry.kind === 'issue'
      ? entry.assignee
      : entry.updatedBy === undefined
        ? undefined
        : labels.rows.updatedBy(entry.updatedBy);
  return [entry.projectName, detail].filter((part) => part !== undefined).join(' · ');
}

export function entityRow(
  section: string,
  entry: CachedEntry,
  labels: Labels,
  sub?: string,
): Built {
  return build(
    `${section}:${entry.kind}:${entry.id}`,
    {
      kind: entry.kind,
      code: entry.key,
      title: entry.title,
      sub: sub ?? entitySub(entry, labels),
      marker: entry.status,
      tag: entry.type,
    },
    { type: 'navigate', url: entry.url },
    { kind: 'complete', text: entry.key ?? entry.title },
  );
}

export function projectRow(
  section: string,
  project: ProjectEntry,
  space: SpaceEntry,
  labels: Labels,
  sub?: string,
): Built {
  return build(
    `${section}:project:${project.id}`,
    { kind: 'project', title: project.name, sub: sub ?? labels.rows.projectSub(project.key) },
    { type: 'navigate', url: project.url },
    {
      kind: 'project',
      space: { kind: 'space', spaceId: space.id, label: space.label, icon: space.icon },
      project: {
        kind: 'project',
        projectId: project.id,
        projectKey: project.key,
        label: project.name,
      },
    },
  );
}

/** 未接続のスペースは connect 行になる（§9 の根・§7.5） */
export function spaceRow(section: string, space: SpaceEntry, labels: Labels): Built {
  if (!space.connected) return connectRow(section, space, labels);
  return build(
    `${section}:space:${space.id}`,
    {
      kind: 'space',
      title: space.label,
      sub: space.host,
      space: { label: space.label, icon: space.icon },
    },
    { type: 'navigate', url: space.url },
    {
      kind: 'space',
      space: { kind: 'space', spaceId: space.id, label: space.label, icon: space.icon },
    },
  );
}

export function connectRow(section: string, space: SpaceEntry | undefined, labels: Labels): Built {
  return build(
    `${section}:connect:${space?.id ?? 'current'}`,
    {
      kind: 'connect',
      title: space === undefined ? labels.rows.connectThis : labels.rows.connectSpace(space.label),
      tone: 'danger',
    },
    { type: 'connect', spaceId: space?.id },
  );
}

export function copyCommandRow(id: string, title: string, subject: string, text: string): Built {
  return build(
    `commands:command:${id}`,
    { kind: 'command', title, sub: subject },
    { type: 'copy', text, subject },
    { kind: 'complete', text: title },
  );
}

export function descendCommandRow(command: CommandSegment): Built {
  return build(
    `commands:command:${command.commandId}`,
    { kind: 'command', title: command.label },
    { type: 'descend', command },
    { kind: 'command', command },
  );
}

export function searchRow(query: string, scope: Scope, scopeLabel: string, labels: Labels): Built {
  return build(
    'search:search:query',
    {
      kind: 'search',
      title: labels.rows.searchFor(query),
      sub: labels.rows.searchSub(scopeLabel),
      tone: 'accent',
    },
    { type: 'search', query, scope },
  );
}

export function directJumpRow(key: string, url: string, labels: Labels): Built {
  return build(
    `direct:issue:${key}`,
    { kind: 'issue', code: key, title: labels.rows.openDirect, tone: 'accent' },
    { type: 'navigate', url },
    { kind: 'complete', text: key },
  );
}

export function hintRow(id: string, title: string): Built {
  return build(`hint:hint:${id}`, { kind: 'hint', title });
}
