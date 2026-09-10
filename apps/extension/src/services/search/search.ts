import type { SearchScope, SearchState } from '@backlog-palette/core';
import type { SpaceConnection } from '../../storage/schema.ts';
import { listConnections } from '../auth/connect.ts';
import { credentialFor, type SpaceCredential } from '../auth/credentials.ts';
import {
  type BacklogClient,
  type BacklogProject,
  createClient,
  isBacklogRequestError,
} from '../backlog/index.ts';
import type { NonEmpty } from '../backlog/types.ts';
import { documentParams, issueParams, rowFilter, wantsType, wikiParams } from './query.ts';
import { documentRow, issueRow, orderRows, type SearchRow, wikiRow } from './rows.ts';

/**
 * スペース横断の検索（実装プラン §7.4）。
 *
 * スペースごとに独立して投げ、返ってきた順にチャンクを流す。1 スペースの
 * 遅延・認証切れ・レート超過は、そのスペースのチャンクの中に閉じる（§13）。
 * 全スペースを 1 本の並びに合流させるのは呼び出し側（`core/results`）の責務。
 */

export type { SearchRow } from './rows.ts';

export type SearchChunkError = {
  kind: 'unauthorized' | 'rateLimited' | 'offline' | 'unknown';
  retryAt?: number;
};

export type SearchChunk =
  | { spaceKey: string; state: 'loading' }
  | { spaceKey: string; state: 'done'; rows: readonly SearchRow[]; total: number }
  | { spaceKey: string; state: 'error'; error: SearchChunkError };

/** 差し替えられるのは接続の読み出しとクライアントの生成だけ。API 呼び出しは backlog 層を通る */
export type SearchDeps = {
  readonly listConnections: () => Promise<readonly SpaceConnection[]>;
  readonly credentialFor: (spaceKey: string) => Promise<SpaceCredential | undefined>;
  readonly createClient: (host: string, credential: SpaceCredential) => BacklogClient;
};

export type SearchOptions = {
  readonly now?: () => number;
  readonly signal?: AbortSignal;
  /**
   * 並びで優先する現在のスペース。`SearchState` は「どこを検索するか」だけを持ち、
   * 「いまどのタブを見ているか」を持たないので外から受け取る。
   */
  readonly currentSpaceKey?: string;
  readonly deps?: SearchDeps;
};

/**
 * 1 スペースあたりの Wiki の同時本数。
 *
 * Wiki は `projectIdOrKey` が必須でプロジェクト数ぶんのリクエストになる（§18-19）。
 * 参加プロジェクトが数十あるスペースで一斉に撃つと、そのスペースの search 枠
 * （実測 150 / 分）をこの 1 回の検索で使い切る。
 */
export const WIKI_PROJECT_CONCURRENCY = 4;

const DEFAULT_DEPS: SearchDeps = { listConnections, credentialFor, createClient };

function targetSpaces(
  spaces: readonly SpaceConnection[],
  scope: SearchScope,
): readonly SpaceConnection[] {
  if (scope.kind === 'allSpaces') return spaces;
  return spaces.filter((space) => space.spaceKey === scope.spaceKey);
}

/** アーカイブ済みは既定では引かない。ただしプロジェクトを名指ししたときは選択に従う */
function targetProjects(
  projects: readonly BacklogProject[],
  scope: SearchScope,
): readonly BacklogProject[] {
  if (scope.kind === 'project') {
    return projects.filter((project) => project.projectKey === scope.projectKey);
  }
  return projects.filter((project) => !project.archived);
}

function projectIds(projects: readonly BacklogProject[]): NonEmpty<number> | undefined {
  const [first, ...rest] = projects.map((project) => project.id);
  return first === undefined ? undefined : [first, ...rest];
}

function toChunkError(cause: unknown): SearchChunkError {
  if (!isBacklogRequestError(cause)) return { kind: 'unknown' };
  if (cause.kind === 'notFound') return { kind: 'unknown' };

  return {
    kind: cause.kind,
    ...(cause.retryAt === undefined ? {} : { retryAt: cause.retryAt }),
  };
}

async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
  stopped: () => boolean,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length && !stopped()) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      results.push(await run(item));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type SpaceContext = {
  readonly state: SearchState;
  readonly deps: SearchDeps;
  readonly now: number;
  readonly currentSpaceKey: string | undefined;
  readonly aborted: () => boolean;
};

/**
 * 「自分」はスペースごとにユーザー id が違うので、その場で引く。
 *
 * `SearchState` は id を持たない（共有 URL に他人の id を載せない、§7.5）。
 */
async function assigneeIdOf(
  state: SearchState,
  client: BacklogClient,
): Promise<number | undefined> {
  if (state.assignee.kind === 'any') return undefined;
  if (state.assignee.kind === 'user') return state.assignee.userId;

  const me = await client.get<{ id: number }>('users/myself');
  return me.id;
}

async function collectRows(
  client: BacklogClient,
  projects: readonly BacklogProject[],
  ctx: SpaceContext,
): Promise<readonly SearchRow[]> {
  const { state } = ctx;
  const rowContext = { spaceKey: client.spaceKey, host: client.host };
  const projectOf = new Map(projects.map((project) => [project.id, project]));

  const ids = projectIds(projects);
  if (ids === undefined) return [];

  const wantIssues = wantsType(state, 'issue');
  const assigneeId = wantIssues ? await assigneeIdOf(state, client) : undefined;
  if (ctx.aborted()) return [];

  const wikiProjects = wantsType(state, 'wiki')
    ? projects.filter((project) => project.useWiki)
    : [];

  const [issues, wikis, documents] = await Promise.all([
    wantIssues
      ? client.issues(issueParams({ state, projectId: ids, assigneeId, now: ctx.now }))
      : [],
    mapWithLimit(
      wikiProjects,
      WIKI_PROJECT_CONCURRENCY,
      (project) => client.wikis(wikiParams(state, project.id)),
      ctx.aborted,
    ),
    wantsType(state, 'document') ? client.documents(documentParams(state, ids)) : [],
  ]);

  return [
    ...issues.map((issue) => issueRow(issue, projectOf.get(issue.projectId), rowContext)),
    ...wikis.flat().map((wiki) => wikiRow(wiki, projectOf.get(wiki.projectId), rowContext)),
    ...documents.flatMap((document) => {
      const project = projectOf.get(document.projectId);
      return project === undefined ? [] : [documentRow(document, project, rowContext)];
    }),
  ];
}

async function searchSpace(space: SpaceConnection, ctx: SpaceContext): Promise<SearchChunk> {
  const { spaceKey } = space;

  try {
    /*
     * 失効が分かっているスペースには投げない。401 を取りに行っても
     * 結果は同じで、他のスペースが使える枠を減らすだけになる。
     */
    if (space.state === 'needsReconnect') {
      return { spaceKey, state: 'error', error: { kind: 'unauthorized' } };
    }

    const credential = await ctx.deps.credentialFor(spaceKey);
    if (credential === undefined) {
      return { spaceKey, state: 'error', error: { kind: 'unauthorized' } };
    }

    const client = ctx.deps.createClient(space.host, credential);
    const projects = targetProjects(await client.projects(), ctx.state.scope);
    const rows = (await collectRows(client, projects, ctx)).filter(rowFilter(ctx.state, ctx.now));
    const ordered = orderRows(rows, ctx.currentSpaceKey);

    return { spaceKey, state: 'done', rows: ordered, total: ordered.length };
  } catch (cause) {
    return { spaceKey, state: 'error', error: toChunkError(cause) };
  }
}

function currentSpaceOf(state: SearchState, options: SearchOptions): string | undefined {
  if (options.currentSpaceKey !== undefined) return options.currentSpaceKey;
  return state.scope.kind === 'allSpaces' ? undefined : state.scope.spaceKey;
}

/** スペースごとに並列で投げ、返ってきた順に `onChunk` を呼ぶ */
export async function runSearch(
  state: SearchState,
  onChunk: (chunk: SearchChunk) => void,
  options: SearchOptions = {},
): Promise<void> {
  const deps = options.deps ?? DEFAULT_DEPS;
  const now = (options.now ?? Date.now)();
  const aborted = () => options.signal?.aborted === true;

  const emit = (chunk: SearchChunk): void => {
    if (aborted()) return;
    onChunk(chunk);
  };

  const spaces = targetSpaces(await deps.listConnections(), state.scope);
  for (const space of spaces) emit({ spaceKey: space.spaceKey, state: 'loading' });

  const ctx: SpaceContext = {
    state,
    deps,
    now,
    currentSpaceKey: currentSpaceOf(state, options),
    aborted,
  };

  await Promise.all(
    spaces.map(async (space) => {
      emit(await searchSpace(space, ctx));
    }),
  );
}
