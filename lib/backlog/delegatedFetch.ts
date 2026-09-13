/**
 * fetch を background に委譲するときの往復の形（D-33）。Request / Response は
 * runtime メッセージに載せられないので、必要な項目だけに直列化する。
 */
export type DelegatedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type DelegatedResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
};

export type DelegatedSend = (request: DelegatedRequest) => Promise<DelegatedResponse>;

function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

export function serializeRequest(
  input: string | URL | Request,
  init?: RequestInit,
): DelegatedRequest {
  const body = init?.body;
  if (body !== undefined && body !== null && typeof body !== 'string') {
    throw new TypeError('委譲できる body は文字列だけ');
  }
  return {
    url: urlOf(input),
    method: init?.method ?? 'GET',
    headers: Object.fromEntries(new Headers(init?.headers)),
    ...(typeof body === 'string' ? { body } : {}),
  };
}

export async function serializeResponse(response: Response): Promise<DelegatedResponse> {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
}

const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

export function deserializeResponse(delegated: DelegatedResponse): Response {
  // Response は本文を持てないステータスに空文字を渡しても投げる
  const body = NO_BODY_STATUSES.has(delegated.status) ? null : delegated.body;
  return new Response(body, {
    status: delegated.status,
    statusText: delegated.statusText,
    headers: delegated.headers,
  });
}

/** 送る手段だけを受け取り、fetch と同じ形の関数を返す */
export function createDelegatedFetch(send: DelegatedSend): typeof globalThis.fetch {
  return async (input, init) => deserializeResponse(await send(serializeRequest(input, init)));
}
