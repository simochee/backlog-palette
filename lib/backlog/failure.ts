import { Error as BacklogErrors } from 'backlog-js';

import type { SearchError } from '@/lib/search/types';

import { RateLimitExceededError, readRateObservation } from './rateLimit';
import { TransportError } from './transportError';

/** API 呼び出しの失敗を行に閉じるための分類（I6、palette.md §7.5）。検索の SearchError と同じ */
export type ApiFailure = SearchError;

function secondsUntilReset(response: Response, now: number): number {
  const { reset } = readRateObservation(response);
  if (reset === undefined) return 60;
  return Math.max(1, Math.ceil(reset - now / 1000));
}

/** 鍵を持たないスペースへ問い合わせた。パレットでは未接続・再接続の行になる */
export class NotConnectedError extends Error {
  readonly spaceHost: string;

  constructor(spaceHost: string) {
    super('not connected');
    this.name = 'NotConnectedError';
    this.spaceHost = spaceHost;
  }
}

export function toApiFailure(error: unknown, now: number = Date.now()): ApiFailure {
  if (error instanceof NotConnectedError) return { kind: 'unauthorized' };
  if (error instanceof RateLimitExceededError) {
    return { kind: 'rateLimited', retryAfterSeconds: error.retryAfterSeconds };
  }
  if (error instanceof BacklogErrors.BacklogError) {
    if (error.status === 401) return { kind: 'unauthorized' };
    if (error.status === 429) {
      return {
        kind: 'rateLimited',
        retryAfterSeconds: secondsUntilReset(error.response, now),
      };
    }
    return { kind: 'failed' };
  }
  if (error instanceof TransportError) return { kind: 'offline' };
  return { kind: 'failed' };
}
