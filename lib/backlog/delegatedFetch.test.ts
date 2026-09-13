import { describe, expect, it } from 'vitest';

import {
  createDelegatedFetch,
  type DelegatedRequest,
  deserializeResponse,
  serializeRequest,
  serializeResponse,
} from './delegatedFetch';

describe('委譲する fetch', () => {
  it('URL・メソッド・ヘッダを直列化して送り、返った status・headers・本文から Response を組む', async () => {
    const sent: DelegatedRequest[] = [];
    const fetch = createDelegatedFetch((request) => {
      sent.push(request);
      return Promise.resolve({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '599' },
        body: '{"id":1}',
      });
    });

    const response = await fetch(new URL('https://demo.backlog.jp/api/v2/users/myself'), {
      method: 'GET',
      headers: { 'Backlog-API-Key': 'secret' },
    });

    expect(sent).toEqual([
      {
        url: 'https://demo.backlog.jp/api/v2/users/myself',
        method: 'GET',
        headers: { 'backlog-api-key': 'secret' },
      },
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('599');
    await expect(response.json()).resolves.toEqual({ id: 1 });
  });

});

describe('直列化の境界', () => {
  it('文字列でない body は委譲できない', () => {
    expect(() => serializeRequest('https://demo.backlog.jp/', { body: new FormData() })).toThrow(
      TypeError,
    );
  });

  it('本文を持てないステータスは空の Response になる', async () => {
    const response = deserializeResponse({ status: 204, statusText: '', headers: {}, body: '' });

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
  });

  it('Response は status・statusText・全ヘッダ・本文に直列化される', async () => {
    const delegated = await serializeResponse(
      new Response('{"errors":[]}', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'X-RateLimit-Reset': '1700000060' },
      }),
    );

    expect(delegated).toMatchObject({
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'x-ratelimit-reset': '1700000060' },
      body: '{"errors":[]}',
    });
  });
});
