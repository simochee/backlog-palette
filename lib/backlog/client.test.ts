import { describe, expect, it, vi } from 'vitest';

import { bucketOf, createSpaceClient } from './client';
import { toApiFailure } from './failure';
import { createRateLimiter, type RateLimiter, type RateLimitStore } from './rateLimit';

const HOST = 'demo.backlog.jp';
const API_KEY = 'secret-key';

function memoryStore(): RateLimitStore {
  const records = new Map<string, Parameters<RateLimitStore['save']>[1]>();
  return {
    load: (host) => Promise.resolve(records.get(host)),
    save: (host, record) => {
      records.set(host, record);
      return Promise.resolve();
    },
  };
}

type Call = { url: URL; headers: Headers };

function fakeFetch(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetch = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: new URL(input instanceof Request ? input.url : input),
      headers: new Headers(init?.headers),
    };
    calls.push(call);
    return Promise.resolve(respond(call));
  });
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status: 200, ...init, headers });
}

const myself = { id: 1, userId: 'ryoya', name: '田村' };

function client(
  fetch: typeof globalThis.fetch,
  extra: Partial<Parameters<typeof createSpaceClient>[0]> = {},
) {
  return createSpaceClient({
    spaceHost: HOST,
    apiKey: API_KEY,
    rateLimiter: createRateLimiter(memoryStore()),
    fetch,
    ...extra,
  });
}

describe('認証の渡し方', () => {
  it('API キーは Backlog-API-Key ヘッダで送り、URL には載せない', async () => {
    const { calls, fetch } = fakeFetch(() => json(myself));

    await client(fetch).getMyself();

    expect(calls[0]?.headers.get('Backlog-API-Key')).toBe(API_KEY);
    expect(calls[0]?.url.toString()).toBe(`https://${HOST}/api/v2/users/myself`);
  });

  it('query 退避ではキーを apiKey クエリで送り、ヘッダには載せない', async () => {
    const { calls, fetch } = fakeFetch(() => json(myself));

    await client(fetch, { transport: 'query' }).getMyself();

    expect(calls[0]?.headers.has('Backlog-API-Key')).toBe(false);
    expect(calls[0]?.url.searchParams.get('apiKey')).toBe(API_KEY);
  });
});

describe('レート制御との接続', () => {
  it('撃つ前に枠を取り、応答のヘッダを枠に報告する', async () => {
    const order: string[] = [];
    const rateLimiter: RateLimiter = {
      acquire: (_host, bucket) => {
        order.push(`acquire:${bucket}`);
        return Promise.resolve();
      },
      report: (_host, bucket, observation) => {
        order.push(`report:${bucket}:${observation.remaining}`);
        return Promise.resolve();
      },
      initialize: () => Promise.resolve(),
    };
    const { fetch } = fakeFetch(() =>
      json([], { headers: { 'X-RateLimit-Limit': '150', 'X-RateLimit-Remaining': '149' } }),
    );

    await client(fetch, { rateLimiter }).getIssues({ projectId: [1] });

    expect(order).toEqual(['acquire:search', 'report:search:149']);
  });

  it('課題・Wiki・ドキュメントの一覧と件数は search 枠、画像は icon 枠、他は read 枠', () => {
    expect(bucketOf('/api/v2/issues')).toBe('search');
    expect(bucketOf('/api/v2/issues/count')).toBe('search');
    expect(bucketOf('/api/v2/wikis')).toBe('search');
    expect(bucketOf('/api/v2/documents')).toBe('search');
    expect(bucketOf('/api/v2/space/image')).toBe('icon');
    expect(bucketOf('/api/v2/projects/PROJ/image')).toBe('icon');
    expect(bucketOf('/api/v2/users/12/icon')).toBe('icon');
    expect(bucketOf('/api/v2/projects')).toBe('read');
    expect(bucketOf('/api/v2/users/myself')).toBe('read');
    expect(bucketOf('/api/v2/rateLimit')).toBe('read');
  });
});

describe('失敗の分類', () => {
  const now = 1_700_000_000_000;

  it('401 は unauthorized になる', async () => {
    const { fetch } = fakeFetch(() => json({ errors: [] }, { status: 401 }));

    const failure = await client(fetch).getMyself().catch(toApiFailure);

    expect(failure).toEqual({ kind: 'unauthorized' });
  });

  it('429 は Reset までの秒数を持つ rateLimited になる', async () => {
    const reset = Math.floor(now / 1000) + 25;
    const { fetch } = fakeFetch(() =>
      json({ errors: [] }, { status: 429, headers: { 'X-RateLimit-Reset': String(reset) } }),
    );

    const failure = await client(fetch)
      .getIssues({ projectId: [1] })
      .catch((error: unknown) => toApiFailure(error, now));

    expect(failure).toEqual({ kind: 'rateLimited', retryAfterSeconds: 25 });
  });
});

describe('失敗の分類（応答以外）', () => {
  it('手元の枠が尽きて待てないときも rateLimited になる', () => {
    const rateLimiter = createRateLimiter(
      {
        load: () => Promise.resolve({ search: { limit: 1, firedAt: [Date.now()] } }),
        save: () => Promise.resolve(),
      },
      { maxWaitMs: 0 },
    );
    const { fetch } = fakeFetch(() => json([]));

    return expect(
      client(fetch, { rateLimiter })
        .getIssues({ projectId: [1] })
        .catch(toApiFailure),
    ).resolves.toMatchObject({ kind: 'rateLimited' });
  });

  it('ネットワーク断は offline になる', async () => {
    const fetch = (() =>
      Promise.reject(new TypeError('Failed to fetch'))) as typeof globalThis.fetch;

    const failure = await client(fetch).getMyself().catch(toApiFailure);

    expect(failure).toEqual({ kind: 'offline' });
  });

  it('background に委譲した fetch の失敗も、TypeError の形を失っていても offline になる', async () => {
    const fetch = (() =>
      Promise.reject(
        Object.assign(new Error('NetworkError when attempting to fetch resource.'), {
          name: 'TypeError',
        }),
      )) as typeof globalThis.fetch;

    const failure = await client(fetch).getMyself().catch(toApiFailure);

    expect(failure).toEqual({ kind: 'offline' });
  });

  it('応答を受け取った後の加工で投げた TypeError はオフラインにならない', () => {
    expect(toApiFailure(new TypeError("Cannot read properties of null (reading 'name')"))).toEqual(
      { kind: 'failed' },
    );
  });

  it('その他のエラー応答は failed になる', async () => {
    const { fetch } = fakeFetch(() => json({ errors: [] }, { status: 500 }));

    const failure = await client(fetch).getMyself().catch(toApiFailure);

    expect(failure).toEqual({ kind: 'failed' });
  });
});
