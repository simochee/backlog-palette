import type { Labels } from '@/components/labels';
import { isStrong, match, type MatchResult, type MatchTarget } from '@/lib/match/match';
import type { NormalizedQuery } from '@/lib/query/normalize';
import { frecencyByEntity } from '@/lib/rank/frecency';
import { queryDictScores } from '@/lib/rank/queryDict';
import { type RankContext, type Ranked, rankWithinSection } from '@/lib/rank/rank';
import type { CommandSegment, Scope } from '@/lib/stack/types';

import { type CachedEntry, entityId, type PaletteIndex, type SpaceEntry } from './model';
import {
  type Built,
  copyCommandRow,
  descendCommandRow,
  entityRow,
  pageRow,
  projectRow,
  spaceRow,
} from './rows';
import type { BuiltSection } from './sections';

export type Candidate = {
  built: Built;
  target: MatchTarget;
  /** 名前が安定している候補だけ「強いローカル一致」に数える（D-26） */
  stable: boolean;
  context: RankContext;
  activityId: string;
  /** コマンド名の完全一致は個人化で動かない */
  pinExact?: boolean;
};

export type Matched = Ranked<Built> & { strong: boolean };

type Env = { index: PaletteIndex; scope: Scope; labels: Labels };

function contextOf(scope: Scope, spaceId: string, projectId?: string): RankContext {
  if (scope.kind === 'root') return 'other';
  if (scope.spaceId !== spaceId) return 'other';
  if (scope.kind === 'project' && projectId !== undefined && scope.projectId === projectId)
    return 'currentProject';
  return 'currentSpace';
}

function spaceOf(index: PaletteIndex, spaceId: string): SpaceEntry | undefined {
  return index.spaces.find((space) => space.id === spaceId);
}

function pageCandidates({ index, scope, labels }: Env, section: string): Candidate[] {
  const owner = scope.kind === 'root' ? undefined : spaceOf(index, scope.spaceId);
  const sub =
    scope.kind === 'root'
      ? labels.rows.commonPageSub
      : `${owner?.label ?? ''} · ${labels.rows.pageSub}`;
  return index.pagesFor(scope).map((page) => ({
    built: pageRow(section, page, sub),
    target: { text: page.title, aliases: page.aliases },
    stable: true,
    context: scope.kind === 'root' ? 'other' : 'currentProject',
    activityId: entityId('page', page.id),
  }));
}

export function projectCandidates({ index, scope, labels }: Env, section: string): Candidate[] {
  return index.projects.flatMap((project) => {
    const space = spaceOf(index, project.spaceId);
    if (space === undefined) return [];
    if (scope.kind !== 'root' && project.spaceId !== scope.spaceId) return [];
    return [
      {
        built: projectRow(section, project, space, labels),
        target: { text: project.name, aliases: [project.key] },
        stable: true,
        context: contextOf(scope, project.spaceId, project.id),
        activityId: entityId('project', project.id),
      },
    ];
  });
}

export function spaceCandidates({ index, labels }: Env, section: string): Candidate[] {
  return index.spaces.map((space) => ({
    built: spaceRow(section, space, labels),
    target: { text: space.label, aliases: [space.host, space.id] },
    stable: true,
    context: 'other',
    activityId: entityId('space', space.id),
  }));
}

function cacheCandidates({ index, scope, labels }: Env, section: string): Candidate[] {
  if (scope.kind === 'root') return [];
  return index.cache
    .filter((entry) => entry.spaceId === scope.spaceId)
    .map((entry) => ({
      built: entityRow(section, entry, labels),
      target: { text: entry.title, aliases: entry.key === undefined ? [] : [entry.key] },
      stable: false,
      context: contextOf(scope, entry.spaceId, entry.projectId),
      activityId: entityId(entry.kind, entry.id),
    }));
}

export const switchSpaceCommand: CommandSegment = {
  kind: 'command',
  commandId: 'switch-space',
  label: '',
};

/** コピー 4 種は課題ページのときだけ、スペースを切り替えはスコープが [space] のときだけ（§4） */
export function commandCandidates({ index, scope, labels }: Env): Candidate[] {
  const candidates: Candidate[] = [];
  const issue = index.currentIssue;
  if (issue !== undefined) {
    const copies: [string, string, string][] = [
      ['copy-key', labels.rows.copyIssueKey, issue.key],
      ['copy-url', labels.rows.copyIssueUrl, issue.url],
      ['copy-title', labels.rows.copyIssueTitle, `${issue.key} ${issue.title}`],
      ['copy-md', labels.rows.copyIssueMarkdown, `[${issue.key} ${issue.title}](${issue.url})`],
    ];
    for (const [id, title, text] of copies)
      candidates.push({
        built: copyCommandRow(id, title, issue.key, text),
        target: { text: title },
        stable: true,
        context: 'other',
        activityId: entityId('command', id),
        pinExact: true,
      });
  }
  if (scope.kind === 'space')
    candidates.push({
      built: descendCommandRow({ ...switchSpaceCommand, label: labels.rows.switchSpace }),
      target: { text: labels.rows.switchSpace },
      stable: true,
      context: 'other',
      activityId: entityId('command', switchSpaceCommand.commandId),
      pinExact: true,
    });
  return candidates;
}

/** 自由語の「ページ」セクションの材料: ページ定義、プロジェクト、スペース、表示キャッシュ（§4） */
export function pageSectionCandidates(env: Env): Candidate[] {
  return [
    ...pageCandidates(env, 'pages'),
    ...projectCandidates(env, 'pages'),
    ...spaceCandidates(env, 'pages'),
    ...cacheCandidates(env, 'pages'),
  ];
}

/** 根の共通ページ（個人設定・API キー）。根の照合対象はこれとスペース名だけ（D-20） */
export function commonPageCandidates(env: Env): Candidate[] {
  return pageCandidates(env, 'common');
}

/** 照合して同じ強さの中だけ個人化で並べる。language は語が空なら全件を元の順で返す */
export function matchAll(
  candidates: readonly Candidate[],
  query: NormalizedQuery,
  index: PaletteIndex,
): Matched[] {
  const scores = frecencyByEntity(index.activity, index.now);
  // この語で開いたことのある対象を、同じ強さ・同じ文脈の中で先に出す（M6 の学習）
  const learned = queryDictScores(index.queryDict, query.folded, index.now);
  const ranked: Matched[] = [];
  for (const candidate of candidates) {
    const result: MatchResult | undefined =
      query.folded === '' ? { strength: 'substring', via: 'text' } : match(query, candidate.target);
    if (result === undefined) continue;
    ranked.push({
      id: candidate.built.row.id,
      item: candidate.built,
      match: result,
      pinned: candidate.pinExact === true && result.strength === 'exact',
      context: candidate.context,
      personalScore: (scores.get(candidate.activityId) ?? 0) + (learned.get(candidate.activityId) ?? 0),
      strong: candidate.stable && isStrong(result),
    });
  }
  return query.folded === '' ? ranked : rankWithinSection(ranked);
}

export function toSection(
  id: string,
  matched: readonly Matched[],
  label: string | undefined,
  cap?: number,
): BuiltSection {
  return { id, label, rows: matched.map((m) => m.item), cap };
}

export function cachedIssuesStartingWith(
  index: PaletteIndex,
  scope: Scope,
  key: string,
): CachedEntry[] {
  if (scope.kind === 'root') return [];
  return index.cache.filter(
    (entry) =>
      entry.kind === 'issue' &&
      entry.spaceId === scope.spaceId &&
      entry.key !== undefined &&
      entry.key.startsWith(key),
  );
}
