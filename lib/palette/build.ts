import type { Labels } from '@/components/labels';
import { normalize, type NormalizedQuery } from '@/lib/query/normalize';
import { parseQuery, type QueryIntent } from '@/lib/query/parse';
import type { SearchSession } from '@/lib/search/types';
import { activeCommand } from '@/lib/stack/stack';
import type { Scope, Stack } from '@/lib/stack/types';

import {
  cachedIssuesStartingWith,
  commandCandidates,
  commonPageCandidates,
  matchAll,
  type Matched,
  pageSectionCandidates,
  projectCandidates,
  spaceCandidates,
  toSection,
} from './candidates';
import { argumentSections, emptySections, rootSections } from './empty';
import type { PaletteIndex, SpaceEntry } from './model';
import { resultsSection, searchRowSub } from './results';
import { type Built, directJumpRow, entityRow, searchRow } from './rows';
import { type BuiltSection, SECTION_CAP } from './sections';
import type { PaletteState } from './state';

export type Env = {
  index: PaletteIndex;
  scope: Scope;
  labels: Labels;
  session?: SearchSession;
  /** サイドパネルへ渡せるか。渡せないときは 0 件の panel 行を出さない（surfaces.md §5.5・I2） */
  panelAvailable: boolean;
};

function currentSpace(index: PaletteIndex, scope: Scope): SpaceEntry | undefined {
  return scope.kind === 'root' ? undefined : index.spaces.find((s) => s.id === scope.spaceId);
}

/**
 * 検索行と、セッションがあればその直下の検索結果（D-3）。検索中の検索行は補足が進捗に変わる。
 * セッションの有無で行の順序が変わらないよう、検索行の id は同じにする
 */
function searchSections(env: Env, query: string, scopeName: string): BuiltSection[] {
  const { index, scope, labels, session } = env;
  if (session === undefined)
    return [{ id: 'search', rows: [searchRow(query, scope, scopeName, labels)] }];
  const sub = searchRowSub(session, currentSpace(index, scope), labels);
  return [
    { id: 'search', rows: [searchRow(query, scope, scopeName, labels, sub)] },
    resultsSection(env, session),
  ];
}

function keySections(env: Env, key: string, scopeName: string): BuiltSection[] {
  const { index, scope, labels } = env;
  if (scope.kind === 'root') return [];
  const issues = cachedIssuesStartingWith(index, scope, key).map((e) =>
    entityRow('issues', e, labels),
  );
  return [
    { id: 'direct', rows: [directJumpRow(key, index.issueUrl(scope.spaceId, key), labels)] },
    { id: 'issues', label: labels.sections.issues(key), rows: issues, cap: SECTION_CAP },
    ...searchSections(env, key, scopeName),
  ];
}

/** 根の照合はスペース名と共通ページ名だけで、空状態と同じ 2 セクションに分けて出す（D-20） */
function rootTextSections(env: Env, query: NormalizedQuery): BuiltSection[] {
  const { index, labels } = env;
  return [
    toSection(
      'spaces',
      matchAll(spaceCandidates(env, 'spaces'), query, index),
      labels.sections.spaces,
    ),
    toSection(
      'common',
      matchAll(commonPageCandidates(env), query, index),
      labels.sections.commonPages,
    ),
  ];
}

const navigateUrl = (built: Built): string | undefined =>
  built.action?.type === 'navigate' ? built.action.url : undefined;

/**
 * 検索結果に出た対象は候補から落とす。同じ課題が結果と候補に 2 度並ぶと、
 * 「どちらを押しても同じ」ことを利用者が確かめる手段が無い。落とすのは検索行より下なので
 * 選択行は動かない（I4）
 */
function withoutShown(
  candidates: BuiltSection[],
  results: BuiltSection | undefined,
): BuiltSection[] {
  if (results === undefined) return candidates;
  const shown = new Set(results.rows.flatMap((built) => navigateUrl(built) ?? []));
  return candidates.map((section) => ({
    ...section,
    rows: section.rows.filter((built) => {
      const url = navigateUrl(built);
      return url === undefined || !shown.has(url);
    }),
  }));
}

/** 自由語: 強いローカル一致があれば候補が先、無ければ検索行が先（§4・D-26） */
function textSections(env: Env, term: string, scopeName: string): BuiltSection[] {
  const { index, scope, labels } = env;
  const query = normalize(term);
  if (scope.kind === 'root') return rootTextSections(env, query);
  const pages = matchAll(pageSectionCandidates(env), query, index);
  const commands = matchAll(commandCandidates(env), query, index);
  const search = searchSections(env, term, scopeName);
  const candidates = withoutShown(
    [
      toSection('pages', pages, labels.sections.pages, SECTION_CAP),
      toSection('commands', commands, labels.sections.commands, SECTION_CAP),
    ],
    search[1],
  );
  const strong = pages.some((m: Matched) => m.strong) || commands.some((m: Matched) => m.strong);
  // 検索中は結果が検索行の直下に入り、候補はその下に残る（D-3）。強い一致でも順序は変えない
  return strong && env.session === undefined
    ? [...candidates, ...search]
    : [...search, ...candidates];
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

function currentProjectKey(stack: Stack): string | undefined {
  const project = stack.segments.find((s) => s.kind === 'project');
  return project?.kind === 'project' ? project.projectKey : undefined;
}

export function buildSections(state: PaletteState, env: Env, scopeName: string): BuiltSection[] {
  const command = activeCommand(state.stack);
  if (command !== undefined) return argumentSections(env, command);
  const intent = parseQuery(state.input, {
    currentProjectKey: currentProjectKey(state.stack),
    knownProjectKeys: new Set(env.index.projects.map((p) => p.key)),
  });
  return sectionsOf(env, intent, scopeName);
}
