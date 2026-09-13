import { AsyncRateLimiter } from '@tanstack/pacer';

/**
 * Backlog のレート枠のうち Phase 1 が使う 3 つ（backlog-facts.md §3.6）。
 * update は書き込みで、Phase 1 に書き込みは無い（P2）。
 */
export type RateBucket = 'read' | 'search' | 'icon';
export const rateBuckets: readonly RateBucket[] = ['read', 'search', 'icon'];

export const RATE_WINDOW_MS = 60_000;

/**
 * これを超えて待つなら待たずに rateLimited を返す。パレットは「混み合っています —
 * N 秒後に再試行」の行を出せる（palette.md §7.5）ので、黙って待たせるより速く伝える。
 */
export const DEFAULT_MAX_WAIT_MS = 1_000;

/** 1 枠の共有状態。`firedAt` は窓の中で撃った時刻（エポックミリ秒）。タブ間で storage を通して共有する */
export type BucketRecord = {
  limit: number;
  firedAt: readonly number[];
  /** 429 を受けたときの `X-RateLimit-Reset`（ミリ秒）。この時刻まで撃たない */
  blockedUntil?: number;
};

export type SpaceRateRecord = Partial<Record<RateBucket, BucketRecord>>;

/** 状態の置き場所。拡張では storage、テストではメモリ */
export type RateLimitStore = {
  load: (spaceHost: string) => Promise<SpaceRateRecord | undefined>;
  save: (spaceHost: string, record: SpaceRateRecord) => Promise<void>;
};

/** 応答から読んだレート情報。ヘッダが無い値は undefined */
export type RateObservation = {
  status: number;
  limit?: number;
  remaining?: number;
  /** UTC epoch 秒 */
  reset?: number;
};

/** `GET /api/v2/rateLimit` の戻り（backlog-facts.md §3.6） */
export type RateLimitSnapshot = Record<RateBucket, { limit: number; remaining: number }>;

export type RateLimiter = {
  /** 撃ってよくなるまで待つ。上限が未知の枠は待たずに通す。待ちが長すぎれば RateLimitExceededError */
  acquire: (spaceHost: string, bucket: RateBucket) => Promise<void>;
  /** 応答のヘッダで手元の残数を補正する。429 なら Reset まで止める */
  report: (spaceHost: string, bucket: RateBucket, observation: RateObservation) => Promise<void>;
  /** `GET /rateLimit` の実値で上限と残数を初期化する */
  initialize: (spaceHost: string, snapshot: RateLimitSnapshot) => Promise<void>;
};

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    super('rate limit exceeded');
    this.name = 'RateLimitExceededError';
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}

function readIntHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null) return undefined;
  const value = Math.trunc(Number(raw));
  return Number.isNaN(value) ? undefined : value;
}

export function readRateObservation(response: {
  status: number;
  headers: Headers;
}): RateObservation {
  return {
    status: response.status,
    limit: readIntHeader(response.headers, 'X-RateLimit-Limit'),
    remaining: readIntHeader(response.headers, 'X-RateLimit-Remaining'),
    reset: readIntHeader(response.headers, 'X-RateLimit-Reset'),
  };
}

function inWindow(firedAt: readonly number[], now: number): number[] {
  return firedAt.filter((time) => time > now - RATE_WINDOW_MS);
}

/**
 * サーバの残数に手元を合わせる。手元が多く見えていれば今の時刻で埋め、少なく見えて
 * いれば古い方から捨てる。サーバは固定窓（Reset で全回復）、手元は sliding なので、
 * 窓の切り替わり直後は手元が厳しく見える。補正しないと使える枠を余らせる。
 */
function reconcile(firedAt: number[], limit: number, remaining: number, now: number): number[] {
  const used = Math.max(0, limit - remaining);
  if (firedAt.length < used) {
    return [...firedAt, ...Array.from<number>({ length: used - firedAt.length }).fill(now)];
  }
  return firedAt.slice(firedAt.length - used);
}

function blockedUntilOf(
  current: BucketRecord | undefined,
  observation: RateObservation,
  now: number,
): number | undefined {
  if (observation.status === 429) {
    return observation.reset === undefined ? now + RATE_WINDOW_MS : observation.reset * 1000;
  }
  if (current?.blockedUntil !== undefined && current.blockedUntil > now) return current.blockedUntil;
  return undefined;
}

/** 応答 1 つ分を枠の状態に畳み込む。上限がどこからも分からなければ undefined */
export function applyObservation(
  current: BucketRecord | undefined,
  observation: RateObservation,
  now: number,
): BucketRecord | undefined {
  const limit = observation.limit ?? current?.limit;
  if (limit === undefined) return undefined;

  const recent = inWindow(current?.firedAt ?? [], now);
  const firedAt =
    observation.remaining === undefined
      ? recent
      : reconcile(recent, limit, observation.remaining, now);
  const blockedUntil = blockedUntilOf(current, observation, now);
  return blockedUntil === undefined ? { limit, firedAt } : { limit, firedAt, blockedUntil };
}

type Deps = {
  sleep?: (ms: number) => Promise<void>;
  maxWaitMs?: number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type Gate = AsyncRateLimiter<() => Promise<void>>;

function syncGate(gate: Gate, record: BucketRecord): Gate {
  gate.setOptions({ limit: record.limit });
  /*
   * Pacer の内部 setState を通さず executionTimes を直接入れ替える。storage が正で
   * インスタンスは計算役という向きにするため。isExceeded / status は古くなるが、
   * 読むのは getMsUntilNextWindow だけで、それは executionTimes から計算される。
   */
  gate.store.setState((state) => ({ ...state, executionTimes: record.firedAt.toSorted((a, b) => a - b) }));
  return gate;
}

function withoutBlock(record: BucketRecord, firedAt: readonly number[]): BucketRecord {
  return { limit: record.limit, firedAt };
}

type Serialize = <T>(spaceHost: string, task: () => Promise<T>) => Promise<T>;

/*
 * 同じスペースへの読み書きを 1 本に並べる。load → save の間に別の acquire が挟まると
 * 発射の記録が失われる。待ち（sleep）はこの外で行い、他の枠を塞がない。
 */
function createSerializer(): Serialize {
  const queues = new Map<string, Promise<unknown>>();
  return (spaceHost, task) => {
    const previous = queues.get(spaceHost) ?? Promise.resolve();
    const run = previous.then(task, task);
    queues.set(
      spaceHost,
      run.catch(() => null),
    );
    return run;
  };
}

type GateFor = (spaceHost: string, bucket: RateBucket, record: BucketRecord) => Gate;

function createGatePool(): GateFor {
  const gates = new Map<string, Gate>();
  return (spaceHost, bucket, record) => {
    const key = `${spaceHost}/${bucket}`;
    const gate =
      gates.get(key) ??
      new AsyncRateLimiter(() => Promise.resolve(), {
        limit: record.limit,
        window: RATE_WINDOW_MS,
        windowType: 'sliding',
      });
    gates.set(key, gate);
    return syncGate(gate, record);
  };
}

function snapshotRecord(snapshot: RateLimitSnapshot, now: number): SpaceRateRecord {
  const record: SpaceRateRecord = {};
  for (const bucket of rateBuckets) {
    const { limit, remaining } = snapshot[bucket];
    record[bucket] = applyObservation(undefined, { status: 200, limit, remaining }, now);
  }
  return record;
}

export function createRateLimiter(store: RateLimitStore, deps: Deps = {}): RateLimiter {
  const sleep = deps.sleep ?? defaultSleep;
  const maxWaitMs = deps.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const serialize = createSerializer();
  const gateFor = createGatePool();

  /** 撃てたら 0、待つべきなら待ち時間（ミリ秒）を返す */
  const tryFire = (spaceHost: string, bucket: RateBucket): Promise<number> =>
    serialize(spaceHost, async () => {
      const record = await store.load(spaceHost);
      const current = record?.[bucket];
      if (current === undefined) return 0;

      const now = Date.now();
      if (current.blockedUntil !== undefined && current.blockedUntil > now) {
        return current.blockedUntil - now;
      }
      const gate = gateFor(spaceHost, bucket, current);
      const wait = gate.getMsUntilNextWindow();
      if (wait > 0) return wait;

      await gate.maybeExecute();
      await store.save(spaceHost, {
        ...record,
        [bucket]: withoutBlock(current, gate.store.state.executionTimes),
      });
      return 0;
    });

  const acquire = async (spaceHost: string, bucket: RateBucket): Promise<void> => {
    const wait = await tryFire(spaceHost, bucket);
    if (wait === 0) return;
    if (wait > maxWaitMs) throw new RateLimitExceededError(wait);
    await sleep(wait);
    await acquire(spaceHost, bucket);
  };

  const report = (spaceHost: string, bucket: RateBucket, observation: RateObservation) =>
    serialize(spaceHost, async () => {
      const record = (await store.load(spaceHost)) ?? {};
      const next = applyObservation(record[bucket], observation, Date.now());
      if (next === undefined) return;
      await store.save(spaceHost, { ...record, [bucket]: next });
    });

  const initialize = (spaceHost: string, snapshot: RateLimitSnapshot) =>
    serialize(spaceHost, () => store.save(spaceHost, snapshotRecord(snapshot, Date.now())));

  return { acquire, report, initialize };
}
