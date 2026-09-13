import type { IncomingMessage, ServerResponse } from 'node:http';

import { DOCUMENTS, ISSUE_TYPES, PROJECTS, SPACE, STATUSES, TESTER, WIKIS } from './apiData.ts';
import { currentIssues, type IssueUpdate } from './apiIssues.ts';

export type ApiMode = 'ok' | 'unauthorized' | 'rateLimited';

export type ApiRequest = {
  method: string;
  path: string;
  query: Record<string, string[]>;
  /** Backlog-API-Key ヘッダの値。無ければ undefined */
  headerKey: string | undefined;
  /** ?apiKey= の値。無ければ undefined */
  queryKey: string | undefined;
};

/**
 * テストから切り替える偽 API の状態。
 *
 * - mode: 'unauthorized' は鍵が正しくても 401、'rateLimited' は 429 を返す
 * - allowApiKeyHeader: false にすると CORS のプリフライトが Backlog-API-Key を許さない。
 *   ヘッダ付き fetch が通らないときの退避（?apiKey=、backlog-facts.md §5-15）を試すため
 * - requests: 受けたリクエストの記録。ヘッダで鍵を送ったかをテストが確かめる
 */
export type FakeApi = {
  apiKey: string;
  mode: ApiMode;
  allowApiKeyHeader: boolean;
  requests: ApiRequest[];
  /** 課題キーごとの「その後の変更」。再検証（D-14）が今の姿を引き直せるかを見る */
  issueUpdates: Record<string, IssueUpdate>;
  reset: () => void;
};

export const VALID_API_KEY = 'test-api-key-0123456789';

/** 実測値（docs/backlog-facts.md §6.2）。拡張はハードコードせず rateLimit API で初期化する */
const RATE_LIMITS = { read: 600, update: 150, search: 150, icon: 60 } as const;
type RateGroup = keyof typeof RATE_LIMITS;

export function createFakeApi(): FakeApi {
  const api: FakeApi = {
    apiKey: VALID_API_KEY,
    mode: 'ok',
    allowApiKeyHeader: true,
    requests: [],
    issueUpdates: {},
    reset: () => {
      api.apiKey = VALID_API_KEY;
      api.mode = 'ok';
      api.allowApiKeyHeader = true;
      api.requests = [];
      api.issueUpdates = {};
    },
  };
  return api;
}

type Handler = (query: Record<string, string[]>, params: string[], api: FakeApi) => Reply;
type Reply = { status: number; body: unknown };

/*
 * エラーの形（errors 配列）は公式ドキュメントどおり。code の値は実測していない。
 * 拡張は HTTP ステータスで判定し code に依存しない前提で、値は仮置き。
 */
function error(status: number, message: string): Reply {
  return { status, body: { errors: [{ message, code: status, moreInfo: '' }] } };
}

function readProjectIds(query: Record<string, string[]>): number[] {
  return [...(query['projectId[]'] ?? []), ...(query['projectIds[]'] ?? [])].map(Number);
}

function matchesKeyword(keyword: string | undefined, ...fields: string[]): boolean {
  if (keyword === undefined || keyword === '') return true;
  return fields.some((field) => field.includes(keyword));
}

function findProject(idOrKey: string) {
  return PROJECTS.find((p) => p.projectKey === idOrKey || String(p.id) === idOrKey);
}

function filterIssues(query: Record<string, string[]>, api: FakeApi) {
  const projectIds = readProjectIds(query);
  const keyword = query.keyword?.[0];
  return currentIssues(api).filter(
    (i) => projectIds.includes(i.projectId) && matchesKeyword(keyword, i.summary, i.description),
  );
}

function paginate<T>(rows: T[], query: Record<string, string[]>): T[] {
  const offset = Number(query.offset?.[0] ?? 0);
  const count = Number(query.count?.[0] ?? 20);
  return rows.slice(offset, offset + count);
}

const ROUTES: [RegExp, RateGroup, Handler][] = [
  [
    /^\/api\/v2\/rateLimit$/u,
    'read',
    () => ({
      status: 200,
      body: {
        rateLimit: Object.fromEntries(
          Object.entries(RATE_LIMITS).map(([k, limit]) => [
            k,
            { limit, remaining: limit, reset: 0 },
          ]),
        ),
      },
    }),
  ],
  [/^\/api\/v2\/space$/u, 'read', () => ({ status: 200, body: SPACE })],
  [/^\/api\/v2\/users\/myself$/u, 'read', () => ({ status: 200, body: TESTER })],
  [/^\/api\/v2\/projects$/u, 'read', () => ({ status: 200, body: PROJECTS })],
  [
    /^\/api\/v2\/projects\/([^/]+)\/statuses$/u,
    'read',
    (_query, [idOrKey]) => {
      const project = findProject(idOrKey ?? '');
      return project === undefined
        ? error(404, 'No project.')
        : { status: 200, body: STATUSES[project.id] ?? [] };
    },
  ],
  [
    /^\/api\/v2\/projects\/([^/]+)\/issueTypes$/u,
    'read',
    (_query, [idOrKey]) => {
      const project = findProject(idOrKey ?? '');
      return project === undefined
        ? error(404, 'No project.')
        : { status: 200, body: ISSUE_TYPES[project.id] ?? [] };
    },
  ],
  [
    /^\/api\/v2\/issues$/u,
    'search',
    (query, _params, api) =>
      // パラメータ無しはエラー（backlog-facts.md §6.3）
      readProjectIds(query).length === 0
        ? error(400, 'projectId[] is required.')
        : { status: 200, body: paginate(filterIssues(query, api), query) },
  ],
  [
    /^\/api\/v2\/issues\/count$/u,
    'search',
    (query, _params, api) =>
      readProjectIds(query).length === 0
        ? error(400, 'projectId[] is required.')
        : { status: 200, body: { count: filterIssues(query, api).length } },
  ],
  [
    // 課題 1 件。再検証（D-14）が引く。キーでも ID でも引ける
    /^\/api\/v2\/issues\/([^/]+)$/u,
    'read',
    (_query, [idOrKey], api) => {
      const issue = currentIssues(api).find(
        (i) => i.issueKey === idOrKey || String(i.id) === idOrKey,
      );
      return issue === undefined ? error(404, 'No issue.') : { status: 200, body: issue };
    },
  ],
  [
    /^\/api\/v2\/wikis$/u,
    'search',
    (query) => {
      // projectIdOrKey は必須（backlog-facts.md §3.3）。count は効かない（§6.3）
      const project = findProject(query.projectIdOrKey?.[0] ?? '');
      if (project === undefined) return error(400, 'projectIdOrKey is required.');
      const keyword = query.keyword?.[0];
      const rows = WIKIS.filter(
        (w) => w.projectId === project.id && matchesKeyword(keyword, w.name, w.content),
      );
      return { status: 200, body: rows };
    },
  ],
  [
    /^\/api\/v2\/documents$/u,
    'search',
    (query) => {
      // offset は必須（backlog-facts.md §3.4）。projectIds[] は任意で横断できる
      if (query.offset === undefined) return error(400, 'offset is required.');
      const projectIds = readProjectIds(query);
      const keyword = query.keyword?.[0];
      const rows = DOCUMENTS.filter(
        (d) =>
          (projectIds.length === 0 || projectIds.includes(d.projectId)) &&
          matchesKeyword(keyword, d.title, d.plain),
      );
      return { status: 200, body: paginate(rows, query) };
    },
  ],
];

function readQuery(url: URL): Record<string, string[]> {
  const query: Record<string, string[]> = {};
  for (const [key, value] of url.searchParams) (query[key] ??= []).push(value);
  return query;
}

function corsHeaders(api: FakeApi): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': api.allowApiKeyHeader ? 'Backlog-API-Key' : '',
    'access-control-expose-headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    // プリフライトを覚えさせない。テスト中に allowApiKeyHeader を切り替えた直後の fetch に効かせる
    'access-control-max-age': '0',
  };
}

function rateHeaders(group: RateGroup, remaining: number): Record<string, string> {
  return {
    'x-ratelimit-limit': String(RATE_LIMITS[group]),
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
  };
}

function reply(
  res: ServerResponse,
  status: number,
  headers: Record<string, string>,
  body: unknown,
) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function authorize(api: FakeApi, request: ApiRequest): Reply | undefined {
  const key = request.headerKey ?? request.queryKey;
  if (key !== api.apiKey || api.mode === 'unauthorized')
    return error(401, 'Authentication failure.');
  if (api.mode === 'rateLimited') return error(429, 'Rate limit exceeded.');
  return undefined;
}

/** `/api/v2/` へのリクエストを受ける。該当しなければ false を返し、ページの配信に回す */
export function handleApi(
  api: FakeApi,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): boolean {
  if (!url.pathname.startsWith('/api/v2/')) return false;
  const cors = corsHeaders(api);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return true;
  }

  const headerKey = req.headers['backlog-api-key'];
  const request: ApiRequest = {
    method: req.method ?? 'GET',
    path: url.pathname,
    query: readQuery(url),
    headerKey: Array.isArray(headerKey) ? headerKey[0] : headerKey,
    queryKey: url.searchParams.get('apiKey') ?? undefined,
  };
  api.requests.push(request);

  const route = ROUTES.find(([pattern]) => pattern.test(url.pathname));
  if (route === undefined) {
    reply(res, 404, cors, { errors: [{ message: 'Not found.', code: 404, moreInfo: '' }] });
    return true;
  }
  const [pattern, group, handler] = route;

  const denied = authorize(api, request);
  if (denied !== undefined) {
    const remaining = denied.status === 429 ? 0 : RATE_LIMITS[group];
    reply(res, denied.status, { ...cors, ...rateHeaders(group, remaining) }, denied.body);
    return true;
  }

  const params = (pattern.exec(url.pathname) ?? []).slice(1);
  const { status, body } = handler(request.query, params, api);
  reply(res, status, { ...cors, ...rateHeaders(group, RATE_LIMITS[group] - 1) }, body);
  return true;
}
