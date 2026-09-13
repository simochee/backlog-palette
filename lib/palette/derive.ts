import type { Labels } from '@/components/labels';
import type { PaletteView, PathSegmentView } from '@/components/types';
import { deriveBindings, type KeyBinding } from '@/lib/keys/bindings';
import { type Platform, toKeyHints } from '@/lib/keys/match';
import { fold, normalize } from '@/lib/query/normalize';
import { parseQuery, type QueryIntent } from '@/lib/query/parse';
import { activeCommand, scopeOf } from '@/lib/stack/stack';
import type { Scope, Stack } from '@/lib/stack/types';

import {
  cachedIssuesStartingWith,
  commandCandidates,
  matchAll,
  type Matched,
  pageSectionCandidates,
  projectCandidates,
  rootCandidates,
  toSection,
} from './candidates';
import { argumentSections, emptySections, rootSections } from './empty';
import type { PaletteIndex, SpaceEntry } from './model';
import { type Built, directJumpRow, entityRow, type RowAction, searchRow } from './rows';
import { type BuiltSection, capSections, SECTION_CAP } from './sections';
import type { PaletteState, TakeTarget } from './state';

export type DeriveOptions = { platform: Platform; panelAvailable: boolean };

export type DerivedPalette = {
  view: PaletteView;
  bindings: readonly KeyBinding[];
  /** 行 id → ↵ で起きること */
  actions: ReadonlyMap<string, RowAction>;
  /** 行 id → ⇥ で取り込むもの */
  takes: ReadonlyMap<string, TakeTarget>;
};

type Env = { index: PaletteIndex; scope: Scope; labels: Labels };

function currentSpace(index: PaletteIndex, scope: Scope): SpaceEntry | undefined {
  return scope.kind === 'root' ? undefined : index.spaces.find((s) => s.id === scope.spaceId);
}

function scopeLabel(stack: Stack, labels: Labels): string {
  const last = stack.segments.findLast((s) => s.kind !== 'command');
  return last?.label ?? labels.palette.rootScope;
}

function keySections(env: Env, key: string, scopeName: string): BuiltSection[] {
  const { index, scope, labels } = env;
  if (scope.kind === 'root') return [];
  const issues = cachedIssuesStartingWith(index, scope, key).map((e) =>
    entityRow('issues', e, labels),
  );
  return [
    { id: 'direct', rows: [directJumpRow(key, index.issueUrl(scope.spaceId, key), labels)] },
    { id: 'issues', label: labels.sections.issues, rows: issues, cap: SECTION_CAP },
    { id: 'search', rows: [searchRow(key, scope, scopeName, labels)] },
  ];
}

/** 自由語: 強いローカル一致があれば候補が先、無ければ検索行が先（§4・D-26） */
function textSections(env: Env, term: string, scopeName: string): BuiltSection[] {
  const { index, scope, labels } = env;
  const query = normalize(term);
  if (scope.kind === 'root') {
    const matched = matchAll(rootCandidates(env), query, index);
    return [toSection('pages', matched, labels.sections.pages, SECTION_CAP)];
  }
  const pages = matchAll(pageSectionCandidates(env), query, index);
  const commands = matchAll(commandCandidates(env), query, index);
  const search: BuiltSection = { id: 'search', rows: [searchRow(term, scope, scopeName, labels)] };
  const candidates = [
    toSection('pages', pages, labels.sections.pages, SECTION_CAP),
    toSection('commands', commands, labels.sections.commands, SECTION_CAP),
  ];
  const strong = pages.some((m: Matched) => m.strong) || commands.some((m: Matched) => m.strong);
  return strong ? [...candidates, search] : [search, ...candidates];
}

function sectionsOf(env: Env, intent: QueryIntent, scopeName: string): BuiltSection[] {
  const { index, scope, labels } = env;
  switch (intent.kind) {
    case 'empty':
      return scope.kind === 'root'
        ? rootSections(env)
        : emptySections(env, scopeName, currentSpace(index, scope));
    case 'issueKey':
    case 'issueNumber':
      return scope.kind === 'root'
        ? textSections(env, intent.key, scopeName)
        : keySections(env, intent.key, scopeName);
    case 'commands':
      return [
        toSection(
          'commands',
          matchAll(commandCandidates(env), normalize(intent.term), index),
          labels.sections.commands,
        ),
      ];
    case 'projects':
      return [
        toSection(
          'projects',
          matchAll(projectCandidates(env, 'projects'), normalize(intent.term), index),
          labels.sections.projects,
        ),
      ];
    case 'text':
      return textSections(env, intent.term, scopeName);
    default:
      return [];
  }
}

function pathOf(stack: Stack): PathSegmentView[] {
  const lastIndex = stack.segments.length - 1;
  return stack.segments.map((segment, i) => ({
    id:
      segment.kind === 'command'
        ? `command:${segment.commandId}`
        : `${segment.kind}:${segment.kind === 'space' ? segment.spaceId : segment.projectId}`,
    label: segment.label,
    badge: segment.kind !== 'command',
    icon: segment.kind === 'space' ? segment.icon : undefined,
    armed: stack.armedForDelete && i === lastIndex ? true : undefined,
  }));
}

/** ゴースト補完: 先頭行の補完テキストが入力に前方一致するとき、その続きだけ */
function completionOf(input: string, selected: Built | undefined): string | undefined {
  if (input === '' || selected?.take?.kind !== 'complete') return undefined;
  const text = selected.take.text;
  const folded = fold(input);
  if (folded.length !== input.length || !fold(text).startsWith(folded)) return undefined;
  return text.length > input.length ? text.slice(input.length) : undefined;
}

function currentProjectKey(stack: Stack): string | undefined {
  const project = stack.segments.find((s) => s.kind === 'project');
  return project?.kind === 'project' ? project.projectKey : undefined;
}

function buildSections(state: PaletteState, env: Env, scopeName: string): BuiltSection[] {
  if (activeCommand(state.stack) !== undefined) return argumentSections(env);
  const intent = parseQuery(state.input, {
    currentProjectKey: currentProjectKey(state.stack),
    knownProjectKeys: new Set(env.index.projects.map((p) => p.key)),
  });
  return sectionsOf(env, intent, scopeName);
}

function bindingsOf(
  state: PaletteState,
  rows: readonly Built[],
  selected: Built | undefined,
  labels: Labels,
  options: DeriveOptions,
): KeyBinding[] {
  const armed = state.stack.armedForDelete ? state.stack.segments.at(-1) : undefined;
  return deriveBindings(
    {
      selected: selected?.row,
      rowCount: rows.length,
      canPopStack: state.stack.segments.length > 0,
      armedLabel: armed?.label,
      hasInput: state.input.trim() !== '',
      hasResults: (state.session?.rows.length ?? 0) > 0,
      panelAvailable: options.panelAvailable,
    },
    labels,
  );
}

export function derive(
  state: PaletteState,
  index: PaletteIndex,
  labels: Labels,
  options: DeriveOptions,
): DerivedPalette {
  const scope = scopeOf(state.stack);
  const env: Env = { index, scope, labels };
  const { sections, rows } = capSections(
    buildSections(state, env, scopeLabel(state.stack, labels)),
    labels,
  );
  const selected = rows.find((r) => r.row.id === state.selectedId) ?? rows[0];
  const bindings = bindingsOf(state, rows, selected, labels, options);
  const inCommand = activeCommand(state.stack) !== undefined;

  const actions = new Map<string, RowAction>();
  const takes = new Map<string, TakeTarget>();
  for (const { row, action, take } of rows) {
    if (action !== undefined) actions.set(row.id, action);
    if (take !== undefined) takes.set(row.id, take);
  }

  return {
    view: {
      path: pathOf(state.stack),
      input: {
        value: state.input,
        placeholder:
          scope.kind === 'root' ? labels.palette.rootPlaceholder : labels.palette.placeholder,
        completion: completionOf(state.input, selected),
      },
      armedNotice: state.stack.armedForDelete ? labels.palette.armedNotice : undefined,
      escLabel: inCommand ? labels.palette.escBack : labels.palette.escClose,
      sections,
      selectedId: selected?.row.id,
      footer: toKeyHints(bindings, options.platform),
      toast: state.toast,
    },
    bindings,
    actions,
    takes,
  };
}
