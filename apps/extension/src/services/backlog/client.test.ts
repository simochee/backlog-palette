import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client.ts';
import { isBacklogRequestError } from './errors.ts';
import { RATE_LIMIT_WINDOW_MS, type RateLimitSnapshot } from './rateLimit.ts';
import type { DocumentSearchParams, IssueSearchParams, WikiSearchParams } from './types.ts';

const HOST = 'nulab.backlog.jp';
const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);

const FULL_LIMITS: RateLimitSnapshot = {
  read: { limit: 600, remaining: 600, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
  update: { limit: 150, remaining: 150, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
  search: { limit: 150, remaining: 150, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
  icon: { limit: 60, remaining: 60, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
};

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function respondWith(body: unknown, init?: ResponseInit): void {
  fetchMock.mockResolvedValue(jsonResponse(body, init));
}

/** 呼ばれた URL。1 リクエストしか出していない前提で読む */
function requestedUrl(): URL {
  const [input] = fetchMock.mock.calls[0] ?? [];
  return new URL(String(input));
}

function requestedInit(): RequestInit {
  const [, init] = fetchMock.mock.calls[0] ?? [];
  return (init ?? {}) as RequestInit;
}

function requestedHeaders(): Record<string, string> {
  const headers = requestedInit().headers;
  return headers === undefined ? {} : { ...(headers as Record<string, string>) };
}

function client(options: Parameters<typeof createClient>[2] = {}) {
  return createClient(
    HOST,
    { method: 'apiKey', apiKey: 'secret-key' },
    { rateLimit: FULL_LIMITS, now: () => NOW, sleep: async () => {}, ...options },
  );
}

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('リクエストの組み立て', () => {
  it('スペースのホストの API v2 を叩く', async () => {
    respondWith([]);
    await client().projects();

    expect(requestedUrl().origin).toBe('https://nulab.backlog.jp');
    expect(requestedUrl().pathname).toBe('/api/v2/projects');
  });

  it('課題検索はプロジェクト ID を配列として展開する', async () => {
    respondWith([]);
    await client().issues({ projectId: [10, 20], keyword: '請求' });

    const url = requestedUrl();
    expect(url.searchParams.getAll('projectId[]')).toEqual(['10', '20']);
    expect(url.searchParams.get('keyword')).toBe('請求');
  });

  it('課題検索は指定しなかった条件をクエリに載せない', async () => {
    respondWith([]);
    await client().issues({ projectId: [10] });

    expect(requestedUrl().searchParams.has('keyword')).toBe(false);
    expect(requestedUrl().searchParams.has('count')).toBe(false);
  });

  it('課題検索は状態と担当者も配列として展開する', async () => {
    respondWith([]);
    await client().issues({ projectId: [10], statusId: [1, 2], assigneeId: [7], count: 20 });

    const url = requestedUrl();
    expect(url.searchParams.getAll('statusId[]')).toEqual(['1', '2']);
    expect(url.searchParams.getAll('assigneeId[]')).toEqual(['7']);
    expect(url.searchParams.get('count')).toBe('20');
  });

  it('Wiki 検索はプロジェクトとキーワードを送る', async () => {
    respondWith([]);
    await client().wikis({ projectIdOrKey: 'PROJ', keyword: '議事録' });

    const url = requestedUrl();
    expect(url.pathname).toBe('/api/v2/wikis');
    expect(url.searchParams.get('projectIdOrKey')).toBe('PROJ');
    expect(url.searchParams.get('keyword')).toBe('議事録');
  });

  it('ドキュメント検索は projectIds と offset を送る', async () => {
    respondWith([]);
    await client().documents({ projectIds: [10, 20], keyword: '規約', offset: 0 });

    const url = requestedUrl();
    expect(url.pathname).toBe('/api/v2/documents');
    expect(url.searchParams.getAll('projectIds[]')).toEqual(['10', '20']);
    expect(url.searchParams.get('offset')).toBe('0');
  });

  it('状態一覧はプロジェクトごとのパスを叩く', async () => {
    respondWith([]);
    await client().statuses('PROJ');

    expect(requestedUrl().pathname).toBe('/api/v2/projects/PROJ/statuses');
  });

  it('生の GET は backlog-js が覆っていないパスにも投げられる', async () => {
    respondWith({ count: 3 });
    await client().get<{ count: number }>('issues/count', { projectId: [10, 20] });

    const url = requestedUrl();
    expect(url.pathname).toBe('/api/v2/issues/count');
    expect(url.searchParams.getAll('projectId[]')).toEqual(['10', '20']);
  });

  it('生の GET は先頭のスラッシュを付けても同じ URL になる', async () => {
    respondWith({ count: 0 });
    await client().get<{ count: number }>('/documents/count', { projectIds: [10] });

    expect(requestedUrl().pathname).toBe('/api/v2/documents/count');
  });

  it('レスポンスの本文をそのまま返す', async () => {
    respondWith([{ id: 1, projectKey: 'PROJ', name: '請求基盤' }]);

    expect(await client().projects()).toEqual([{ id: 1, projectKey: 'PROJ', name: '請求基盤' }]);
  });
});

describe('認証情報の渡し方', () => {
  it('API キーは URL に残らないようヘッダで送る', async () => {
    respondWith([]);
    await client().projects();

    expect(requestedHeaders()['Backlog-API-Key']).toBe('secret-key');
    expect(requestedUrl().search).not.toContain('secret-key');
  });

  it('OAuth のアクセストークンは Authorization ヘッダで送る', async () => {
    respondWith([]);
    await createClient(
      HOST,
      { method: 'oauth', accessToken: 'token-value' },
      { rateLimit: FULL_LIMITS, now: () => NOW, sleep: async () => {} },
    ).projects();

    expect(requestedHeaders().Authorization).toBe('Bearer token-value');
    expect(requestedUrl().search).not.toContain('token-value');
  });
});

describe('レート上限の初期化', () => {
  it('実値を渡していないときは最初の呼び出しの前に rateLimit を取りに行く', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ rateLimit: FULL_LIMITS }))
      .mockResolvedValueOnce(jsonResponse([]));

    await createClient(
      HOST,
      { method: 'apiKey', apiKey: 'secret-key' },
      { now: () => NOW, sleep: async () => {} },
    ).issues({ projectId: [10] });

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe('/api/v2/rateLimit');
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe('/api/v2/issues');
  });

  it('同時に呼び出しても rateLimit の取得は 1 回で済む', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        new URL(String(input)).pathname === '/api/v2/rateLimit'
          ? jsonResponse({ rateLimit: FULL_LIMITS })
          : jsonResponse([]),
      ),
    );

    const api = createClient(
      HOST,
      { method: 'apiKey', apiKey: 'secret-key' },
      { now: () => NOW, sleep: async () => {} },
    );
    await Promise.all([api.issues({ projectId: [10] }), api.projects()]);

    const rateLimitCalls = fetchMock.mock.calls.filter(
      ([input]) => new URL(String(input)).pathname === '/api/v2/rateLimit',
    );
    expect(rateLimitCalls).toHaveLength(1);
  });

  it('実値を渡してあれば rateLimit は叩かない', async () => {
    respondWith([]);
    await client().issues({ projectId: [10] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rateLimit の取得は 4 枠の実値をそのまま返す', async () => {
    respondWith({ rateLimit: FULL_LIMITS });

    expect(await client().rateLimit()).toEqual(FULL_LIMITS);
  });
});

describe('レート制御', () => {
  it('search 枠が尽きていて待ちが長いときは撃たずに混雑エラーになる', async () => {
    const exhausted: RateLimitSnapshot = {
      ...FULL_LIMITS,
      search: { limit: 150, remaining: 0, reset: (NOW + 30_000) / 1000 },
    };
    const api = client({ rateLimit: exhausted, maxWaitMs: 100 });

    await expect(api.issues({ projectId: [10] })).rejects.toMatchObject({
      kind: 'rateLimited',
      spaceKey: 'nulab',
      retryable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('search 枠が尽きていても read 枠の呼び出しは通る', async () => {
    respondWith([]);
    const exhausted: RateLimitSnapshot = {
      ...FULL_LIMITS,
      search: { limit: 150, remaining: 0, reset: (NOW + 30_000) / 1000 },
    };

    await expect(client({ rateLimit: exhausted }).projects()).resolves.toEqual([]);
  });

  it('残量を伝えるヘッダを受け取ったら次の呼び出しの判断に使う', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([], {
          headers: { 'X-RateLimit-Limit': '150', 'X-RateLimit-Remaining': '0' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([]));

    const api = client({ maxWaitMs: 100 });
    await api.issues({ projectId: [10] });

    await expect(api.issues({ projectId: [10] })).rejects.toMatchObject({ kind: 'rateLimited' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('失敗の伝え方', () => {
  it('401 は再接続が必要なエラーとして投げる', async () => {
    respondWith({ errors: [] }, { status: 401 });

    await expect(client().issues({ projectId: [10] })).rejects.toMatchObject({
      kind: 'unauthorized',
      spaceKey: 'nulab',
      retryable: false,
    });
  });

  it('429 はレート超過として投げ、枠が開く時刻を添える', async () => {
    const resetAt = NOW + 30_000;
    respondWith(
      { errors: [] },
      {
        status: 429,
        headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(resetAt / 1000) },
      },
    );

    await expect(client().issues({ projectId: [10] })).rejects.toMatchObject({
      kind: 'rateLimited',
      retryable: true,
      retryAt: resetAt,
    });
  });

  it('通信が届かないときはオフラインとして投げる', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client().projects()).rejects.toMatchObject({
      kind: 'offline',
      retryable: true,
    });
  });

  it('投げるのは種別つきのエラーだけで、認証情報は載せない', async () => {
    respondWith({ errors: [] }, { status: 401 });

    const error = await client()
      .projects()
      .catch((cause: unknown) => cause);

    expect(isBacklogRequestError(error)).toBe(true);
    expect(JSON.stringify(error instanceof Error ? error.message : error)).not.toContain(
      'secret-key',
    );
  });
});

describe('呼び間違いを型で防ぐ', () => {
  it('プロジェクトを指定しない課題検索は書けない', () => {
    // @ts-expect-error GET /issues はパラメータ無しだとエラーになる（台帳 §6.3）
    const missing: IssueSearchParams = { keyword: '請求' };
    // @ts-expect-error 空配列はプロジェクト未指定と同じ
    const empty: IssueSearchParams = { projectId: [] };

    expect([missing, empty]).toHaveLength(2);
  });

  it('キーワードなしの Wiki 一覧取得は書けない', () => {
    // @ts-expect-error count が効かず全件返るので keyword は必須（台帳 §6.3）
    const params: WikiSearchParams = { projectIdOrKey: 'PROJ' };

    expect(params).toBeDefined();
  });

  it('offset なしのドキュメント検索は書けない', () => {
    // @ts-expect-error offset は必須（台帳 §3.4）
    const params: DocumentSearchParams = { projectIds: [10] };

    expect(params).toBeDefined();
  });
});
