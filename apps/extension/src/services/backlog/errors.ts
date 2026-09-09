/**
 * API の失敗を UI の出し分けに使う 5 種へ写す（実装プラン §13）。
 *
 * 種別は「行内にどう出すか」で切ってある。HTTP ステータスの細かさは
 * ここで捨て、`status` は診断用に添えるだけにする。
 */

export type BacklogErrorKind = 'unauthorized' | 'rateLimited' | 'offline' | 'notFound' | 'unknown';

export type BacklogFailure = {
  readonly kind: BacklogErrorKind;
  /** どのスペースの行にエラーを出すか。§7.4 のスペース単位の並列に対応する */
  readonly spaceKey: string;
  readonly retryable: boolean;
  readonly status?: number;
  /** 再試行して通る見込みの時刻（epoch ミリ秒）。レート超過のときだけ入る */
  readonly retryAt?: number;
};

const SPACE_HOST_SUFFIXES: readonly string[] = ['.backlog.jp', '.backlog.com', '.backlogtool.com'];

/**
 * 既知の Backlog ドメインのときだけ先頭ラベルを取り、それ以外はホスト全体を鍵にする。
 *
 * 常に先頭ラベルを取る実装にはしない。Enterprise のカスタムドメインは任意の形を
 * とりうる（台帳 §4.1）ので、`backlog.example` のようなホストから `backlog` を
 * 切り出すと別のスペースと衝突する。
 */
export function spaceKeyFromHost(host: string): string {
  const lower = host.toLowerCase();
  const suffix = SPACE_HOST_SUFFIXES.find((candidate) => lower.endsWith(candidate));
  if (suffix === undefined) return lower;

  const [label] = lower.slice(0, -suffix.length).split('.');
  return label === undefined || label === '' ? lower : label;
}

export function failureFromStatus(
  status: number,
  spaceKey: string,
  retryAt?: number,
): BacklogFailure {
  if (status === 401) return { kind: 'unauthorized', spaceKey, retryable: false, status };
  if (status === 404) return { kind: 'notFound', spaceKey, retryable: false, status };
  if (status === 429) {
    return retryAt === undefined
      ? { kind: 'rateLimited', spaceKey, retryable: true, status }
      : { kind: 'rateLimited', spaceKey, retryable: true, status, retryAt };
  }
  return { kind: 'unknown', spaceKey, retryable: status >= 500, status };
}

function httpStatusOf(cause: unknown): number | undefined {
  if (typeof cause !== 'object' || cause === null || !('status' in cause)) return undefined;
  const status = cause.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * fetch はネットワークに届かなかったときだけ `TypeError` で reject する。
 * 中断（`AbortError`）は回線ではなくこちらの都合なので offline に混ぜない。
 */
function isNetworkFailure(cause: unknown): boolean {
  return cause instanceof TypeError;
}

export function failureFromCause(
  cause: unknown,
  spaceKey: string,
  retryAt?: number,
): BacklogFailure {
  const status = httpStatusOf(cause);
  if (status !== undefined) return failureFromStatus(status, spaceKey, retryAt);
  if (isNetworkFailure(cause)) return { kind: 'offline', spaceKey, retryable: true };
  return { kind: 'unknown', spaceKey, retryable: false };
}

/**
 * 投げるための器。`message` には種別とスペースキーしか入れない
 * （トークンや API キーがログに残る経路を作らない。§2.3）
 */
export class BacklogRequestError extends Error {
  readonly kind: BacklogErrorKind;
  readonly spaceKey: string;
  readonly retryable: boolean;
  readonly status: number | undefined;
  readonly retryAt: number | undefined;

  constructor(failure: BacklogFailure) {
    super(`${failure.kind}: ${failure.spaceKey}`);
    this.name = 'BacklogRequestError';
    this.kind = failure.kind;
    this.spaceKey = failure.spaceKey;
    this.retryable = failure.retryable;
    this.status = failure.status;
    this.retryAt = failure.retryAt;
  }

  get failure(): BacklogFailure {
    return {
      kind: this.kind,
      spaceKey: this.spaceKey,
      retryable: this.retryable,
      ...(this.status === undefined ? {} : { status: this.status }),
      ...(this.retryAt === undefined ? {} : { retryAt: this.retryAt }),
    };
  }
}

export function isBacklogRequestError(value: unknown): value is BacklogRequestError {
  return value instanceof BacklogRequestError;
}
