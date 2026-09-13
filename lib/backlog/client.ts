import { Backlog } from 'backlog-js';

import { type RateBucket, type RateLimiter, readRateObservation } from './rateLimit';

export type ApiKeyTransport = 'header' | 'query';

/*
 * 鍵はヘッダで送り URL に残さない（backlog-facts.md §3.1）。ヘッダ付きの fetch が
 * CORS のプリフライトを通るかは実機未確認（§5-15）で、通らなければここを 'query'
 * にする。切り替え点はこの 1 箇所（D-31）。
 */
export const API_KEY_TRANSPORT: ApiKeyTransport = 'header';

const API_KEY_HEADER = 'Backlog-API-Key';

export type SpaceClientOptions = {
  /** `demo.backlog.jp` のようなホスト。鍵とレート状態の識別子でもある */
  spaceHost: string;
  apiKey: string;
  rateLimiter: RateLimiter;
  fetch?: typeof globalThis.fetch;
  transport?: ApiKeyTransport;
};

const SEARCH_PATH = /^\/api\/v2\/(?:issues|wikis|documents)(?:\/count)?$/u;
const ICON_PATH = /^\/api\/v2\/(?:space\/image|projects\/[^/]+\/image|users\/[^/]+\/icon)$/u;

/** パスからレート枠を決める（backlog-facts.md §3.6）。ドキュメントは枠が非公開なので厳しい方に寄せる */
export function bucketOf(pathname: string): RateBucket {
  if (SEARCH_PATH.test(pathname)) return 'search';
  if (ICON_PATH.test(pathname)) return 'icon';
  return 'read';
}

type Outgoing = { url: URL; init: RequestInit | undefined };

function moveApiKeyToQuery(url: URL, init: RequestInit | undefined): Outgoing {
  const headers = new Headers(init?.headers);
  const apiKey = headers.get(API_KEY_HEADER);
  if (apiKey === null) return { url, init };
  headers.delete(API_KEY_HEADER);
  const withKey = new URL(url);
  withKey.searchParams.set('apiKey', apiKey);
  return { url: withKey, init: { ...init, headers } };
}

function toUrl(input: string | URL | Request): URL {
  if (input instanceof URL) return input;
  return new URL(typeof input === 'string' ? input : input.url);
}

function createGuardedFetch(options: SpaceClientOptions): typeof globalThis.fetch {
  const { spaceHost, rateLimiter, transport = API_KEY_TRANSPORT } = options;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  return async (input, init) => {
    const url = toUrl(input);
    const bucket = bucketOf(url.pathname);
    await rateLimiter.acquire(spaceHost, bucket);
    const outgoing = transport === 'query' ? moveApiKeyToQuery(url, init) : { url, init };
    const response = await fetchImpl(outgoing.url, outgoing.init);
    await rateLimiter.report(spaceHost, bucket, readRateObservation(response));
    return response;
  };
}

export type SpaceClient = Backlog;

/**
 * スペースごとの backlog-js。fetch を差し替えて、撃つ前にレート枠を取り、応答の
 * X-RateLimit-* を残数に反映する。呼ぶ側はこの層の存在を意識しない。
 */
export function createSpaceClient(options: SpaceClientOptions): SpaceClient {
  return new Backlog({
    host: options.spaceHost,
    apiKey: options.apiKey,
    fetch: createGuardedFetch(options),
  });
}
