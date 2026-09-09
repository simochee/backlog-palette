import { describe, expect, it, vi } from 'vitest';
import {
  applyHeaders,
  applyRateLimited,
  bucketForPath,
  createRateLimitGate,
  initialState,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitSnapshot,
  readRateLimitHeaders,
  reserve,
} from './rateLimit.ts';

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);

/** 台帳 §6.2 の実測値。ここでしか使わない（実装は値を持たない） */
const MEASURED: RateLimitSnapshot = {
  read: { limit: 600, remaining: 600, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
  update: { limit: 150, remaining: 150, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
  search: { limit: 150, remaining: 150, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
  icon: { limit: 60, remaining: 60, reset: (NOW + RATE_LIMIT_WINDOW_MS) / 1000 },
};

function snapshotWith(overrides: Partial<RateLimitSnapshot>): RateLimitSnapshot {
  return { ...MEASURED, ...overrides };
}

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('枠の初期化', () => {
  it('上限と残量は API から受け取った実値になる', () => {
    const state = initialState(MEASURED, NOW);

    expect(state.read).toEqual({ limit: 600, tokens: 600, updatedAt: NOW });
    expect(state.search).toEqual({ limit: 150, tokens: 150, updatedAt: NOW });
  });

  it('残量が上限を超えて報告されても上限までしか持たない', () => {
    const state = initialState(
      snapshotWith({ search: { limit: 150, remaining: 999, reset: 0 } }),
      NOW,
    );

    expect(state.search.tokens).toBe(150);
  });
});

describe('枠の予約', () => {
  it('残量があるうちは待たずに通る', () => {
    const result = reserve(initialState(MEASURED, NOW), 'search', NOW);

    expect(result).toMatchObject({ outcome: 'ready', waitMs: 0 });
  });

  it('通るたびに残量が 1 つ減る', () => {
    const first = reserve(initialState(MEASURED, NOW), 'search', NOW);
    const second = reserve(first.state, 'search', NOW);

    expect(second.state.search.tokens).toBe(148);
  });

  it('search 枠を使い切っても read 枠は待たずに通る', () => {
    const state = initialState(
      snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }),
      NOW,
    );

    expect(reserve(state, 'read', NOW).waitMs).toBe(0);
    expect(reserve(state, 'search', NOW, 60_000).waitMs).toBeGreaterThan(0);
  });

  it('使い切ったあとは 1 つ回復するのに要る時間だけ待って通る', () => {
    const state = initialState(
      snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }),
      NOW,
    );

    // 150 回 / 60 秒 = 1 回あたり 400ms
    expect(reserve(state, 'search', NOW, 1_000)).toMatchObject({
      outcome: 'ready',
      waitMs: 400,
    });
  });

  it('待ち時間が上限を超えるときは待たずに混雑として返す', () => {
    const state = initialState(snapshotWith({ icon: { limit: 60, remaining: 0, reset: 0 } }), NOW);

    // 60 回 / 60 秒 = 1 回あたり 1,000ms。上限 999ms には収まらない
    expect(reserve(state, 'icon', NOW, 999)).toMatchObject({ outcome: 'busy', waitMs: 1_000 });
  });

  it('混雑として断ったときは残量を減らさない', () => {
    const state = initialState(snapshotWith({ icon: { limit: 60, remaining: 0, reset: 0 } }), NOW);
    const result = reserve(state, 'icon', NOW, 0);

    expect(result.state.icon.tokens).toBe(0);
  });

  it('待つ予約が続くと待ち時間はその分だけ伸びる', () => {
    const empty = initialState(
      snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }),
      NOW,
    );
    const first = reserve(empty, 'search', NOW, 2_000);
    const second = reserve(first.state, 'search', NOW, 2_000);

    expect(first.waitMs).toBe(400);
    expect(second.waitMs).toBe(800);
  });

  it('時間が経てば枠は回復する', () => {
    const empty = initialState(
      snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }),
      NOW,
    );

    expect(reserve(empty, 'search', NOW + 400).waitMs).toBe(0);
  });

  it('放置しても回復は上限を超えない', () => {
    const empty = initialState(
      snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }),
      NOW,
    );
    const later = reserve(empty, 'search', NOW + RATE_LIMIT_WINDOW_MS * 10);

    expect(later.state.search.tokens).toBe(149);
  });

  it('上限 0 の枠は待っても通らないので混雑として返す', () => {
    const state = initialState(snapshotWith({ icon: { limit: 0, remaining: 0, reset: 0 } }), NOW);

    expect(reserve(state, 'icon', NOW).outcome).toBe('busy');
  });
});

describe('レスポンスヘッダの取り込み', () => {
  it('残量ヘッダがあれば枠の残量を上書きする', () => {
    const state = applyHeaders(
      initialState(MEASURED, NOW),
      'search',
      headers({ 'X-RateLimit-Limit': '150', 'X-RateLimit-Remaining': '3' }),
      NOW,
    );

    expect(state.search).toEqual({ limit: 150, tokens: 3, updatedAt: NOW });
  });

  it('レート情報のないレスポンスでは枠を触らない', () => {
    const before = initialState(MEASURED, NOW);

    expect(applyHeaders(before, 'search', headers({}), NOW + 1_000)).toBe(before);
  });

  it('数値でないヘッダは無かったものとして扱う', () => {
    expect(readRateLimitHeaders(headers({ 'X-RateLimit-Remaining': 'unknown' }))).toBeUndefined();
  });

  it('reset は UTC 秒なのでミリ秒に直して読む', () => {
    const observed = readRateLimitHeaders(
      headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1789000000' }),
    );

    expect(observed?.resetAt).toBe(1_789_000_000_000);
  });
});

describe('429 を受けたあと', () => {
  it('reset の時刻までは枠が開かない', () => {
    const resetAt = NOW + 30_000;
    const state = applyRateLimited(initialState(MEASURED, NOW), 'search', resetAt, NOW);

    expect(reserve(state, 'search', resetAt - 1, 60_000).waitMs).toBe(1);
    expect(reserve(state, 'search', resetAt, 60_000).waitMs).toBe(0);
  });

  it('reset が分からないときは 1 分ぶん閉じる', () => {
    const state = applyRateLimited(initialState(MEASURED, NOW), 'search', undefined, NOW);

    expect(reserve(state, 'search', NOW + RATE_LIMIT_WINDOW_MS, 60_000).waitMs).toBe(0);
    expect(reserve(state, 'search', NOW, 60_000).waitMs).toBe(RATE_LIMIT_WINDOW_MS);
  });

  it('閉じられた枠は既定の待ち上限では混雑として断られる', () => {
    const state = applyRateLimited(initialState(MEASURED, NOW), 'search', NOW + 30_000, NOW);

    expect(reserve(state, 'search', NOW).outcome).toBe('busy');
  });

  it('他の枠は閉じない', () => {
    const state = applyRateLimited(initialState(MEASURED, NOW), 'search', NOW + 30_000, NOW);

    expect(reserve(state, 'read', NOW).outcome).toBe('ready');
  });
});

describe('枠の振り分け', () => {
  it('課題・Wiki・ドキュメントの検索は search 枠を使う', () => {
    expect(bucketForPath('issues')).toBe('search');
    expect(bucketForPath('issues/count')).toBe('search');
    expect(bucketForPath('wikis')).toBe('search');
    expect(bucketForPath('documents')).toBe('search');
  });

  it('マスタの取得は read 枠を使う', () => {
    expect(bucketForPath('projects')).toBe('read');
    expect(bucketForPath('projects/PROJ/statuses')).toBe('read');
    expect(bucketForPath('rateLimit')).toBe('read');
  });

  it('アイコンと画像は icon 枠を使う', () => {
    expect(bucketForPath('users/1/icon')).toBe('icon');
    expect(bucketForPath('space/image')).toBe('icon');
  });

  it('先頭のスラッシュとクエリは判定に影響しない', () => {
    expect(bucketForPath('/issues?keyword=a')).toBe('search');
  });
});

describe('待ちの制御', () => {
  it('枠が開くまで待ってから通す', async () => {
    const sleep = vi.fn(async () => {});
    const gate = createRateLimitGate({ now: () => NOW, sleep, maxWaitMs: 1_000 });
    gate.prime(snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }));

    expect(await gate.enter('search')).toEqual({ outcome: 'entered', waitedMs: 400 });
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it('待つ必要がなければ待たない', async () => {
    const sleep = vi.fn(async () => {});
    const gate = createRateLimitGate({ now: () => NOW, sleep });
    gate.prime(MEASURED);

    expect(await gate.enter('search')).toEqual({ outcome: 'entered', waitedMs: 0 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('待ち時間が長いときは待たずに混雑を返し、再試行できる時刻を添える', async () => {
    const sleep = vi.fn(async () => {});
    const gate = createRateLimitGate({ now: () => NOW, sleep, maxWaitMs: 100 });
    gate.prime(snapshotWith({ search: { limit: 150, remaining: 0, reset: 0 } }));

    expect(await gate.enter('search')).toEqual({
      outcome: 'busy',
      waitMs: 400,
      retryAt: NOW + 400,
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('実値で初期化していない枠は素通しする', async () => {
    const gate = createRateLimitGate({ now: () => NOW, sleep: async () => {} });

    expect(gate.primed()).toBe(false);
    expect(await gate.enter('search')).toEqual({ outcome: 'entered', waitedMs: 0 });
  });
});
