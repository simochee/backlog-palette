import { Backlog } from 'backlog-js';
import { BacklogRequestError, failureFromCause, spaceKeyFromHost } from './errors.ts';
import {
  bucketForPath,
  createRateLimitGate,
  type RateLimitBucket,
  type RateLimitSnapshot,
  resetAtFromHeaders,
} from './rateLimit.ts';
import type {
  BacklogDocument,
  BacklogIssue,
  BacklogProject,
  BacklogStatus,
  BacklogWiki,
  DocumentSearchParams,
  IssueSearchParams,
  QueryParams,
  WikiSearchParams,
} from './types.ts';

/**
 * スペース 1 つ分の API クライアント（実装プラン §20）。
 *
 * 認証情報はこの層より外に出ない。生成は Service Worker のみが行う前提で、
 * UI から import しない（§2.3）。
 */

export type SpaceCredential =
  | { readonly method: 'apiKey'; readonly apiKey: string }
  | { readonly method: 'oauth'; readonly accessToken: string };

export type BacklogClient = {
  readonly host: string;
  readonly spaceKey: string;
  /** 生の GET。backlog-js が覆っていないエンドポイント用の逃げ道 */
  readonly get: <T>(path: string, params?: QueryParams) => Promise<T>;
  readonly projects: () => Promise<readonly BacklogProject[]>;
  readonly issues: (params: IssueSearchParams) => Promise<readonly BacklogIssue[]>;
  readonly wikis: (params: WikiSearchParams) => Promise<readonly BacklogWiki[]>;
  readonly documents: (params: DocumentSearchParams) => Promise<readonly BacklogDocument[]>;
  readonly statuses: (projectIdOrKey: string | number) => Promise<readonly BacklogStatus[]>;
  readonly rateLimit: () => Promise<RateLimitSnapshot>;
};

export type ClientOptions = {
  /** 既に実測済みのスナップショット。省略すると最初の呼び出し前に自分で取る */
  readonly rateLimit?: RateLimitSnapshot;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxWaitMs?: number;
};

const API_PREFIX = '/api/v2/';

/** 絶対 URL でもパスでも、`api/v2` から下のパスだけを取り出す */
function pathOf(target: string): string {
  const index = target.indexOf(API_PREFIX);
  const tail = index < 0 ? target : target.slice(index + API_PREFIX.length);
  return tail.replace(/\?.*$/, '').replace(/^\/+/, '');
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function mutableNumbers(values: readonly number[]): number[] {
  return [...values];
}

function toIssueQuery(params: IssueSearchParams): QueryParams {
  return {
    projectId: mutableNumbers(params.projectId),
    ...(params.keyword === undefined ? {} : { keyword: params.keyword }),
    ...(params.statusId === undefined ? {} : { statusId: mutableNumbers(params.statusId) }),
    ...(params.assigneeId === undefined ? {} : { assigneeId: mutableNumbers(params.assigneeId) }),
    ...(params.issueTypeId === undefined
      ? {}
      : { issueTypeId: mutableNumbers(params.issueTypeId) }),
    ...(params.count === undefined ? {} : { count: params.count }),
    ...(params.offset === undefined ? {} : { offset: params.offset }),
    ...(params.sort === undefined ? {} : { sort: params.sort }),
    ...(params.order === undefined ? {} : { order: params.order }),
    ...(params.updatedSince === undefined ? {} : { updatedSince: params.updatedSince }),
    ...(params.updatedUntil === undefined ? {} : { updatedUntil: params.updatedUntil }),
  };
}

function toDocumentQuery(params: DocumentSearchParams): QueryParams {
  return {
    projectIds: mutableNumbers(params.projectIds),
    offset: params.offset,
    ...(params.keyword === undefined ? {} : { keyword: params.keyword }),
    ...(params.count === undefined ? {} : { count: params.count }),
    ...(params.sort === undefined ? {} : { sort: params.sort }),
    ...(params.order === undefined ? {} : { order: params.order }),
  };
}

export function createClient(
  host: string,
  credential: SpaceCredential,
  options: ClientOptions = {},
): BacklogClient {
  const spaceKey = spaceKeyFromHost(host);
  const now = options.now ?? (() => Date.now());
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const gate = createRateLimitGate({
    now,
    sleep,
    ...(options.maxWaitMs === undefined ? {} : { maxWaitMs: options.maxWaitMs }),
  });
  if (options.rateLimit !== undefined) gate.prime(options.rateLimit);

  const rateLimitedUntil = new Map<RateLimitBucket, number>();

  /**
   * backlog-js はレスポンスを返さず本文だけを渡すので、レートのヘッダは
   * fetch を包んで拾う。`globalThis.fetch` は呼ぶたびに引き直す
   * （生成時に束ねるとテストの差し替えが効かない）。
   */
  const observedFetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(input, init).then((response) => {
      const bucket = bucketForPath(pathOf(urlOf(input)));
      gate.observeHeaders(bucket, response.headers);

      if (response.status === 429) {
        const resetAt = resetAtFromHeaders(response.headers);
        gate.observeRateLimited(bucket, resetAt);
        rateLimitedUntil.set(bucket, resetAt ?? now());
      }

      return response;
    });

  const backlog = new Backlog({
    host,
    fetch: observedFetch,
    ...(credential.method === 'apiKey'
      ? { apiKey: credential.apiKey }
      : { accessToken: credential.accessToken }),
  });

  function fail(cause: unknown, bucket: RateLimitBucket): BacklogRequestError {
    return new BacklogRequestError(failureFromCause(cause, spaceKey, rateLimitedUntil.get(bucket)));
  }

  async function fetchRateLimit(): Promise<RateLimitSnapshot> {
    try {
      const body = await backlog.getRateLimit();
      gate.prime(body.rateLimit);
      return body.rateLimit;
    } catch (cause) {
      throw fail(cause, 'read');
    }
  }

  let priming: Promise<RateLimitSnapshot> | undefined;

  /**
   * 枠の実値を知るための呼び出し自体は枠で待たせない。待たせると
   * 初期化が自分の完了を待つ循環になる。
   *
   * 起動直後は全スペース・全種別が同時に来るので、初期化は 1 本に束ねる。
   */
  async function ensurePrimed(): Promise<void> {
    if (gate.primed()) return;

    priming ??= fetchRateLimit().finally(() => {
      priming = undefined;
    });
    await priming;
  }

  async function call<T>(path: string, run: () => Promise<T>): Promise<T> {
    const bucket = bucketForPath(path);
    await ensurePrimed();

    const gated = await gate.enter(bucket);
    if (gated.outcome === 'busy') {
      throw new BacklogRequestError({
        kind: 'rateLimited',
        spaceKey,
        retryable: true,
        ...(gated.retryAt === undefined ? {} : { retryAt: gated.retryAt }),
      });
    }

    try {
      return await run();
    } catch (cause) {
      throw fail(cause, bucket);
    }
  }

  return {
    host,
    spaceKey,
    get: <T>(path: string, params?: QueryParams) =>
      call<T>(path, () => backlog.get<T>(pathOf(path), params)),
    projects: () => call('projects', () => backlog.getProjects()),
    issues: (params) => call('issues', () => backlog.getIssues(toIssueQuery(params))),
    wikis: (params) =>
      call('wikis', () =>
        backlog.getWikis({ projectIdOrKey: params.projectIdOrKey, keyword: params.keyword }),
      ),
    /*
     * ドキュメントだけ生の GET を使う。backlog-js の `getDocuments` は
     * `projectId[]` を送るが、実測で応答するのは `projectIds[]`（台帳 §6.3）。
     * ライブラリが直るまでパラメータ名をこちらで持つ。
     */
    documents: (params) =>
      call('documents', () => backlog.get<BacklogDocument[]>('documents', toDocumentQuery(params))),
    statuses: (projectIdOrKey) =>
      call(`projects/${projectIdOrKey}/statuses`, () => backlog.getProjectStatuses(projectIdOrKey)),
    rateLimit: () => fetchRateLimit(),
  };
}
