import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyObservation,
  createRateLimiter,
  RATE_WINDOW_MS,
  RateLimitExceededError,
  type RateLimitStore,
  readRateObservation,
  type SpaceRateRecord,
} from './rateLimit';

const HOST = 'demo.backlog.jp';
const T0 = 1_700_000_000_000;

function memoryStore(initial: Record<string, SpaceRateRecord> = {}): RateLimitStore & {
  records: Record<string, SpaceRateRecord>;
} {
  const records = { ...initial };
  return {
    records,
    load: (host) => Promise.resolve(records[host]),
    save: (host, record) => {
      records[host] = record;
      return Promise.resolve();
    },
  };
}

/** sleep を記録しつつ、その分だけ時計を進める */
function fakeSleep() {
  const waits: number[] = [];
  const sleep = (ms: number) => {
    waits.push(ms);
    vi.advanceTimersByTime(ms);
    return Promise.resolve();
  };
  return { waits, sleep };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('acquire', () => {
  it('上限が未知の枠は待たずに通す', async () => {
    const { waits, sleep } = fakeSleep();
    const limiter = createRateLimiter(memoryStore(), { sleep });

    await limiter.acquire(HOST, 'search');

    expect(waits).toEqual([]);
  });

  it('上限まで撃ったら、最も古い発射が窓から出るまで待ってから通す', async () => {
    const { waits, sleep } = fakeSleep();
    const store = memoryStore({ [HOST]: { search: { limit: 2, firedAt: [] } } });
    const limiter = createRateLimiter(store, { sleep, maxWaitMs: RATE_WINDOW_MS });

    await limiter.acquire(HOST, 'search');
    vi.advanceTimersByTime(10_000);
    await limiter.acquire(HOST, 'search');
    await limiter.acquire(HOST, 'search');

    expect(waits).toEqual([RATE_WINDOW_MS - 10_000]);
    expect(store.records[HOST]?.search?.firedAt).toHaveLength(2);
  });

  it('待ちが上限を超えるときは待たず rateLimited を投げ、再試行までの秒数を持つ', async () => {
    const { sleep } = fakeSleep();
    const store = memoryStore({ [HOST]: { search: { limit: 1, firedAt: [T0] } } });
    const limiter = createRateLimiter(store, { sleep, maxWaitMs: 1_000 });

    const failure = await limiter.acquire(HOST, 'search').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RateLimitExceededError);
    expect(failure).toMatchObject({ retryAfterSeconds: 60 });
  });

});

describe('acquire の共有', () => {
  it('ある枠の待ちは別の枠を塞がない', async () => {
    const { waits, sleep } = fakeSleep();
    const store = memoryStore({
      [HOST]: { search: { limit: 1, firedAt: [T0] }, read: { limit: 100, firedAt: [] } },
    });
    const limiter = createRateLimiter(store, { sleep, maxWaitMs: RATE_WINDOW_MS });

    const search = limiter.acquire(HOST, 'search');
    await limiter.acquire(HOST, 'read');

    expect(store.records[HOST]?.read?.firedAt).toHaveLength(1);
    await search;
    expect(waits).toEqual([RATE_WINDOW_MS]);
  });

  it('別のタブ相当の limiter が同じ store から残数を引き継ぐ', async () => {
    const store = memoryStore({ [HOST]: { search: { limit: 2, firedAt: [] } } });
    const first = createRateLimiter(store, { sleep: fakeSleep().sleep });
    const second = createRateLimiter(store, { sleep: fakeSleep().sleep, maxWaitMs: 0 });

    await first.acquire(HOST, 'search');
    await first.acquire(HOST, 'search');

    await expect(second.acquire(HOST, 'search')).rejects.toBeInstanceOf(RateLimitExceededError);
  });
});

describe('report', () => {
  it('最初の応答の X-RateLimit-Limit で上限が決まる', async () => {
    const store = memoryStore();
    const limiter = createRateLimiter(store);

    await limiter.report(HOST, 'read', { status: 200, limit: 600, remaining: 599 });

    expect(store.records[HOST]?.read).toEqual({ limit: 600, firedAt: [T0] });
  });

  it('Remaining が手元の残数より少なければ、その分を使った扱いにする', async () => {
    const store = memoryStore({ [HOST]: { search: { limit: 150, firedAt: [T0] } } });
    const limiter = createRateLimiter(store);

    await limiter.report(HOST, 'search', { status: 200, remaining: 140 });

    expect(store.records[HOST]?.search?.firedAt).toHaveLength(10);
  });

  it('Remaining が手元の残数より多ければ、古い発射から捨てて合わせる', async () => {
    const store = memoryStore({
      [HOST]: { search: { limit: 150, firedAt: [T0 - 30_000, T0 - 20_000, T0 - 10_000] } },
    });
    const limiter = createRateLimiter(store);

    await limiter.report(HOST, 'search', { status: 200, remaining: 149 });

    expect(store.records[HOST]?.search?.firedAt).toEqual([T0 - 10_000]);
  });

  it('429 を受けたら Reset の時刻まで撃たない', async () => {
    const { waits, sleep } = fakeSleep();
    const store = memoryStore({ [HOST]: { search: { limit: 150, firedAt: [] } } });
    const limiter = createRateLimiter(store, { sleep, maxWaitMs: RATE_WINDOW_MS });
    const reset = Math.floor(T0 / 1000) + 30;

    await limiter.report(HOST, 'search', { status: 429, remaining: 0, reset });
    await limiter.acquire(HOST, 'search');

    expect(waits[0]).toBe(30_000);
    expect(store.records[HOST]?.search?.blockedUntil).toBeUndefined();
  });
});

describe('initialize', () => {
  it('GET /rateLimit の実値で 3 枠の上限と残数を初期化する', async () => {
    const store = memoryStore();
    const limiter = createRateLimiter(store);

    await limiter.initialize(HOST, {
      read: { limit: 600, remaining: 600 },
      search: { limit: 150, remaining: 148 },
      icon: { limit: 60, remaining: 60 },
    });

    expect(store.records[HOST]?.read).toEqual({ limit: 600, firedAt: [] });
    expect(store.records[HOST]?.search?.firedAt).toEqual([T0, T0]);
    expect(store.records[HOST]?.icon?.limit).toBe(60);
  });
});

describe('applyObservation', () => {
  it('上限がヘッダにも手元にも無ければ何も決めない', () => {
    expect(applyObservation(undefined, { status: 200, remaining: 5 }, T0)).toBeUndefined();
  });

  it('窓から出た発射は数えない', () => {
    const next = applyObservation(
      { limit: 10, firedAt: [T0 - RATE_WINDOW_MS - 1, T0 - 1] },
      { status: 200 },
      T0,
    );

    expect(next?.firedAt).toEqual([T0 - 1]);
  });
});

describe('readRateObservation', () => {
  it('X-RateLimit-* ヘッダを数値で読み、無いものは undefined にする', () => {
    const response = new Response(null, {
      status: 200,
      headers: { 'X-RateLimit-Limit': '150', 'X-RateLimit-Remaining': '149' },
    });

    expect(readRateObservation(response)).toEqual({
      status: 200,
      limit: 150,
      remaining: 149,
      reset: undefined,
    });
  });
});
