/**
 * スペースごとのレート制御（実装プラン §7.4、`docs/backlog-facts.md` §3.6・§6.2）。
 *
 * 枠は Backlog が持つ 4 つと同じに切る。上限はプランと種別で変わり公開されて
 * いないので、値はここに書かず `GET /api/v2/rateLimit` の実測で初期化する。
 *
 * 時刻はすべて引数で受ける。純粋関数の集まりに保ち、待ちが必要な部分だけを
 * `createRateLimitGate` に閉じる。
 */

export type RateLimitBucket = 'read' | 'update' | 'search' | 'icon';

/** `GET /api/v2/rateLimit` の 1 枠。`reset` は UTC epoch 秒 */
export type ApiRateLimit = {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
};

export type RateLimitSnapshot = { readonly [K in RateLimitBucket]: ApiRateLimit };

export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * これを超えて待つなら待たずに諦める。§14 の「検索の最初の結果 ≤ 1s」に合わせた。
 * 待たせ続けるより「混み合っています — 再試行」を行内に出したほうが操作を止めない（§13）。
 */
export const DEFAULT_MAX_WAIT_MS = 1_000;

export type BucketState = {
  readonly limit: number;
  /** 端数と負の値を許す。負は「まだ発射していない予約」を表す */
  readonly tokens: number;
  readonly updatedAt: number;
};

export type RateLimitState = { readonly [K in RateLimitBucket]: BucketState };

function refillRate(limit: number): number {
  return limit / RATE_LIMIT_WINDOW_MS;
}

function withBucket(
  state: RateLimitState,
  bucket: RateLimitBucket,
  next: BucketState,
): RateLimitState {
  return { ...state, [bucket]: next };
}

function bucketFrom(frame: ApiRateLimit, now: number): BucketState {
  return { limit: frame.limit, tokens: Math.min(frame.remaining, frame.limit), updatedAt: now };
}

export function initialState(snapshot: RateLimitSnapshot, now: number): RateLimitState {
  return {
    read: bucketFrom(snapshot.read, now),
    update: bucketFrom(snapshot.update, now),
    search: bucketFrom(snapshot.search, now),
    icon: bucketFrom(snapshot.icon, now),
  };
}

/**
 * 窓の切り替わりを待たずに少しずつ回復させる。サーバの窓（1 分固定）を
 * そのまま真似ると窓の先頭で全スペースが同時に発射して 429 を呼ぶので、
 * 平均が上限に収まる連続回復にしている。
 */
function refill(bucket: BucketState, now: number): BucketState {
  const elapsed = Math.max(0, now - bucket.updatedAt);
  if (elapsed === 0) return bucket;

  return {
    limit: bucket.limit,
    tokens: Math.min(bucket.limit, bucket.tokens + elapsed * refillRate(bucket.limit)),
    updatedAt: now,
  };
}

function waitForToken(tokens: number, limit: number): number {
  const deficit = 1 - tokens;
  if (deficit <= 0) return 0;

  const rate = refillRate(limit);
  return rate > 0 ? Math.ceil(deficit / rate) : Number.POSITIVE_INFINITY;
}

export type Reservation = {
  readonly outcome: 'ready' | 'busy';
  /** `ready` なら発射前に待つべき時間。`busy` なら諦めた見込みの待ち時間 */
  readonly waitMs: number;
  readonly state: RateLimitState;
};

/**
 * 枠を 1 つ予約する。`ready` のときは呼び出し側が `waitMs` だけ待ってから撃つ。
 * 予約時点でトークンを引くので、並列に予約した分は自然にずれて撃たれる。
 */
export function reserve(
  state: RateLimitState,
  bucket: RateLimitBucket,
  now: number,
  maxWaitMs: number = DEFAULT_MAX_WAIT_MS,
): Reservation {
  const current = refill(state[bucket], now);
  const refilled = withBucket(state, bucket, current);
  const waitMs = waitForToken(current.tokens, current.limit);

  if (waitMs > maxWaitMs) return { outcome: 'busy', waitMs, state: refilled };

  return {
    outcome: 'ready',
    waitMs,
    state: withBucket(refilled, bucket, { ...current, tokens: current.tokens - 1 }),
  };
}

export type HeaderReader = { get: (name: string) => string | null };

export type ObservedRateLimit = {
  readonly remaining: number;
  readonly limit?: number;
  readonly resetAt?: number;
};

function numberHeader(headers: HeaderReader, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** `X-RateLimit-Reset` は UTC epoch 秒。ミリ秒に直して返す */
export function resetAtFromHeaders(headers: HeaderReader): number | undefined {
  const reset = numberHeader(headers, 'X-RateLimit-Reset');
  return reset === undefined ? undefined : reset * 1000;
}

export function readRateLimitHeaders(headers: HeaderReader): ObservedRateLimit | undefined {
  const remaining = numberHeader(headers, 'X-RateLimit-Remaining');
  if (remaining === undefined) return undefined;

  const limit = numberHeader(headers, 'X-RateLimit-Limit');
  const resetAt = resetAtFromHeaders(headers);

  return {
    remaining,
    ...(limit === undefined ? {} : { limit }),
    ...(resetAt === undefined ? {} : { resetAt }),
  };
}

export function applyHeaders(
  state: RateLimitState,
  bucket: RateLimitBucket,
  headers: HeaderReader,
  now: number,
): RateLimitState {
  const observed = readRateLimitHeaders(headers);
  if (observed === undefined) return state;

  const limit = observed.limit ?? state[bucket].limit;

  return withBucket(state, bucket, {
    limit,
    tokens: Math.min(observed.remaining, limit),
    updatedAt: now,
  });
}

/**
 * 429 を受けた枠は `reset` まで開けない。
 *
 * トークンを「reset の時刻にちょうど 1 に戻る」負の値にして表す。
 * 別の締切フィールドを持たせると回復の計算が 2 系統になり、
 * どちらが効いているのか読めなくなる。
 */
export function applyRateLimited(
  state: RateLimitState,
  bucket: RateLimitBucket,
  resetAt: number | undefined,
  now: number,
): RateLimitState {
  const current = state[bucket];
  const closedUntil = resetAt ?? now + RATE_LIMIT_WINDOW_MS;
  const closedMs = Math.max(0, closedUntil - now);

  return withBucket(state, bucket, {
    limit: current.limit,
    tokens: Math.min(0, 1 - closedMs * refillRate(current.limit)),
    updatedAt: now,
  });
}

const SEARCH_PATHS: readonly string[] = [
  'issues',
  'issues/count',
  'wikis',
  'wikis/count',
  'documents',
  'documents/count',
];

/**
 * 枠の判定はパスだけで決める。検索は課題・Wiki・ドキュメントの一覧と件数、
 * アイコンと画像は icon 枠、残りは read 枠（この層は GET しか出さないので
 * update 枠は消費しないが、状態としては 4 枠すべてを持つ）。
 */
export function bucketForPath(path: string): RateLimitBucket {
  const normalized = path.replace(/^\/+/, '').replace(/\?.*$/, '');
  if (SEARCH_PATHS.includes(normalized)) return 'search';
  if (/(^|\/)(icon|image)$/.test(normalized)) return 'icon';
  return 'read';
}

export type GateResult =
  | { readonly outcome: 'entered'; readonly waitedMs: number }
  | { readonly outcome: 'busy'; readonly waitMs: number; readonly retryAt?: number };

export type RateLimitGate = {
  readonly primed: () => boolean;
  readonly prime: (snapshot: RateLimitSnapshot) => void;
  readonly snapshotState: () => RateLimitState | undefined;
  readonly enter: (bucket: RateLimitBucket) => Promise<GateResult>;
  readonly observeHeaders: (bucket: RateLimitBucket, headers: HeaderReader) => void;
  readonly observeRateLimited: (bucket: RateLimitBucket, resetAt: number | undefined) => void;
};

export type RateLimitGateOptions = {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly maxWaitMs?: number;
};

/**
 * 純粋な状態機械に「待つ」だけを足した薄い器。時計と待ちを外から渡すので
 * ブラウザ API を使わずに試せる。
 */
export function createRateLimitGate(options: RateLimitGateOptions): RateLimitGate {
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  let state: RateLimitState | undefined;

  return {
    primed: () => state !== undefined,
    prime: (snapshot) => {
      state = initialState(snapshot, options.now());
    },
    snapshotState: () => state,
    enter: async (bucket) => {
      if (state === undefined) return { outcome: 'entered', waitedMs: 0 };

      const at = options.now();
      const reservation = reserve(state, bucket, at, maxWaitMs);
      state = reservation.state;

      if (reservation.outcome === 'busy') {
        return Number.isFinite(reservation.waitMs)
          ? { outcome: 'busy', waitMs: reservation.waitMs, retryAt: at + reservation.waitMs }
          : { outcome: 'busy', waitMs: reservation.waitMs };
      }

      if (reservation.waitMs > 0) await options.sleep(reservation.waitMs);
      return { outcome: 'entered', waitedMs: reservation.waitMs };
    },
    observeHeaders: (bucket, headers) => {
      if (state === undefined) return;
      state = applyHeaders(state, bucket, headers, options.now());
    },
    observeRateLimited: (bucket, resetAt) => {
      if (state === undefined) return;
      state = applyRateLimited(state, bucket, resetAt, options.now());
    },
  };
}
