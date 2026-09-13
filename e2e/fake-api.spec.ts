import type { Page } from '@playwright/test';

import { VALID_API_KEY } from './fixtures/api.ts';
import { expect, test } from './fixtures/extension.ts';

type Response = { status: number; headers: Record<string, string>; body: unknown };

/*
 * ブラウザの中から fetch する。page.request は Node 側の HTTP クライアントで
 * --host-resolver-rules を通らず、本物の demo.backlog.jp に届いてしまう。
 * 偽スペースのページを開いた上で同一オリジンに投げるので CORS は掛からない。
 */
function request(page: Page, url: string, key?: string): Promise<Response> {
  return page.evaluate(
    async (input) => {
      const init = input.key === undefined ? {} : { headers: { 'Backlog-API-Key': input.key } };
      const res = await fetch(input.url, init);
      const text = await res.text();
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: text === '' ? undefined : (JSON.parse(text) as unknown),
      };
    },
    { url, key },
  );
}

/** 別オリジンのページから、ヘッダ付きで fetch する。CORS のプリフライトが掛かる経路 */
function requestCrossOrigin(page: Page, url: string, key: string): Promise<number | 'blocked'> {
  return page.evaluate(
    async (input) => {
      try {
        const res = await fetch(input.url, { headers: { 'Backlog-API-Key': input.key } });
        return res.status;
      } catch {
        return 'blocked';
      }
    },
    { url, key },
  );
}

const q = encodeURIComponent;

/** 偽スペースの API そのものの仕様。接続と検索の E2E（M4）はこの振る舞いを前提に書く */
test.describe('偽スペースの Backlog API', () => {
  test.beforeEach(async ({ page, space }) => {
    await page.goto(space.url('/dashboard'));
  });

  test('Backlog-API-Key ヘッダの鍵が正しければ 200 と X-RateLimit-* ヘッダを返す', async ({
    page,
    space,
  }) => {
    const res = await request(page, space.url('/api/v2/users/myself'), VALID_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: 'tester' });
    expect(res.headers['x-ratelimit-limit']).toBe('600');
    expect(res.headers['x-ratelimit-remaining']).toBe('599');
    expect(space.api.requests.at(-1)).toMatchObject({
      path: '/api/v2/users/myself',
      headerKey: VALID_API_KEY,
      queryKey: undefined,
    });
  });

  test('?apiKey= でも認証でき、ヘッダで送ったかどうかを記録で見分けられる', async ({
    page,
    space,
  }) => {
    const res = await request(page, space.url(`/api/v2/rateLimit?apiKey=${VALID_API_KEY}`));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rateLimit: { search: { limit: 150 } } });
    expect(space.api.requests.at(-1)).toMatchObject({
      headerKey: undefined,
      queryKey: VALID_API_KEY,
    });
  });

  test('鍵が無い・違うときは 401 を errors 配列で返す', async ({ page, space }) => {
    const missing = await request(page, space.url('/api/v2/projects'));
    const wrong = await request(page, space.url('/api/v2/projects'), 'wrong');

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(wrong.body).toMatchObject({ errors: [{ message: expect.any(String) }] });
  });

  test("mode を 'unauthorized' にすると正しい鍵でも 401（認証切れの再現）", async ({
    page,
    space,
  }) => {
    space.api.mode = 'unauthorized';
    const res = await request(page, space.url('/api/v2/users/myself'), VALID_API_KEY);

    expect(res.status).toBe(401);
  });

  test("mode を 'rateLimited' にすると 429 と remaining 0 を返す", async ({ page, space }) => {
    space.api.mode = 'rateLimited';
    const res = await request(page, space.url('/api/v2/issues?projectId[]=101'), VALID_API_KEY);

    expect(res.status).toBe(429);
    expect(res.headers['x-ratelimit-limit']).toBe('150');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(Date.now() / 1000);
  });

  test('課題検索は projectId[] が必須で、keyword は件名と本文に一致し、count は Search 枠を使う', async ({
    page,
    space,
  }) => {
    const key = VALID_API_KEY;
    const noProject = await request(page, space.url('/api/v2/issues'), key);
    const byBody = await request(
      page,
      space.url(`/api/v2/issues?projectId[]=101&keyword=${q('白画面')}`),
      key,
    );
    const count = await request(
      page,
      space.url(`/api/v2/issues/count?projectId[]=101&keyword=${q('フロー')}`),
      key,
    );

    expect(noProject.status).toBe(400);
    expect(byBody.body).toMatchObject([{ issueKey: 'PROJ-142' }]);
    expect(count.body).toEqual({ count: 2 });
    expect(count.headers['x-ratelimit-limit']).toBe('150');
  });

  test('Wiki は projectIdOrKey が必須で本文を含み、ドキュメントは offset が必須で plain を含む', async ({
    page,
    space,
  }) => {
    const key = VALID_API_KEY;
    const noProject = await request(page, space.url('/api/v2/wikis'), key);
    const wikis = await request(
      page,
      space.url(`/api/v2/wikis?projectIdOrKey=PROJ&keyword=${q('デプロイ')}`),
      key,
    );
    const noOffset = await request(page, space.url('/api/v2/documents'), key);
    const documents = await request(
      page,
      space.url(`/api/v2/documents?offset=0&keyword=${q('リトライ')}`),
      key,
    );

    expect(noProject.status).toBe(400);
    expect(wikis.body).toMatchObject([{ name: 'リリース手順', content: expect.any(String) }]);
    expect(noOffset.status).toBe(400);
    expect(documents.body).toMatchObject([{ id: 'doc-a1B2c3', plain: expect.any(String) }]);
  });

  test('ステータスはプロジェクトごとに違う一覧を返し、キーでも ID でも引ける', async ({
    page,
    space,
  }) => {
    const byKey = await request(page, space.url('/api/v2/projects/PROJ/statuses'), VALID_API_KEY);
    const byId = await request(page, space.url('/api/v2/projects/102/statuses'), VALID_API_KEY);

    expect(byKey.body).toHaveLength(5);
    expect(byId.body).toHaveLength(4);
  });

  test('権限の無いオリジンからのヘッダ付き fetch はプリフライトを通り、allowApiKeyHeader を切ると通らない', async ({
    page,
    space,
  }) => {
    await page.goto(space.url('/', 'other.example'));
    const url = space.url('/api/v2/users/myself');

    expect(await requestCrossOrigin(page, url, VALID_API_KEY)).toBe(200);
    space.api.allowApiKeyHeader = false;
    expect(await requestCrossOrigin(page, url, VALID_API_KEY)).toBe('blocked');
  });

  /*
   * backlog-facts.md §5-15 の Chrome 側。content script の matches はホスト権限として
   * 扱われ、拡張オリジンからスペースへの fetch は CORS を受けない。プリフライトの
   * 可否が問題になるのは、権限を持たないカスタムドメイン（surfaces.md §8）だけ。
   */
  test('拡張オリジンからスペースへの fetch は matches がホスト権限になり、プリフライトを受けない', async ({
    space,
    serviceWorker,
  }) => {
    space.api.allowApiKeyHeader = false;
    const status = await serviceWorker.evaluate(
      async (input) => {
        const res = await fetch(input.url, { headers: { 'Backlog-API-Key': input.key } });
        return res.status;
      },
      { url: space.url('/api/v2/users/myself'), key: VALID_API_KEY },
    );

    expect(status).toBe(200);
    expect(space.api.requests.at(-1)).toMatchObject({ headerKey: VALID_API_KEY });
  });
});
