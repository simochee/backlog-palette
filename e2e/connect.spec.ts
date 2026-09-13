import type { Page } from '@playwright/test';

import { VALID_API_KEY } from './fixtures/api.ts';
import { PROJECTS, SPACE } from './fixtures/apiData.ts';
import { expect, test } from './fixtures/extension.ts';
import { API_SETTINGS_PATH, MEMO_INPUT, SPACE_HOST } from './fixtures/space.ts';

const CONNECT_FRAME = 'iframe[data-backlog-palette-connect]';
const KEY_INPUT_LABEL = 'API キー';

function sheet(page: Page) {
  const frame = page.frameLocator(CONNECT_FRAME);
  return {
    frame,
    section: frame.getByRole('region', { name: 'Backlog Palette に接続' }),
    input: frame.getByLabel(KEY_INPUT_LABEL),
  };
}

test.describe('API キーで接続する導線', () => {
  test('未接続 → 発行ページで貼り付け → 接続完了 → storage に鍵とプロジェクトが入る', async ({
    page,
    space,
    readStorage,
  }) => {
    await page.goto(space.url(`${API_SETTINGS_PATH}#bp-connect`));

    // メモ欄はページが後から描く。描かれた時点で埋まる
    await expect(page.locator(MEMO_INPUT)).toHaveValue('Backlog Palette');

    const { frame, input } = sheet(page);
    await expect(page.locator(CONNECT_FRAME)).toBeVisible();
    // 打鍵がバーの入力欄に届く（フォーカスが iframe に移っている）
    await page.keyboard.type(VALID_API_KEY);
    await expect(input).toHaveValue(VALID_API_KEY);
    await page.keyboard.press('Enter');

    await expect(frame.getByText(`${SPACE.name} に接続しました`)).toBeVisible();
    expect(await readStorage<Record<string, string>>('apiKeys')).toEqual({
      [SPACE_HOST]: VALID_API_KEY,
    });
    expect(await readStorage<{ host: string }[]>('spaces')).toEqual([
      expect.objectContaining({
        host: SPACE_HOST,
        name: SPACE.name,
        spaceKey: SPACE.spaceKey,
        projectCount: PROJECTS.length,
      }),
    ]);
    expect(await readStorage<Record<string, unknown>>('rateLimits')).toMatchObject({
      [SPACE_HOST]: { search: { limit: 150 } },
    });
    // 鍵はヘッダで送られ、URL には載らない
    const paths = space.api.requests.map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v2/users/myself',
        '/api/v2/space',
        '/api/v2/rateLimit',
        '/api/v2/projects',
        ...PROJECTS.map((project) => `/api/v2/projects/${project.id}/statuses`),
      ]),
    );
    // マスタは Query のキャッシュとして永続化され、パレットが開いたときに即描ける
    const cache = await readStorage<{ clientState: { queries: { queryKey: unknown[] }[] } }>(
      'queryCache',
    );
    expect(cache?.clientState.queries.map((q) => q.queryKey)).toEqual(
      expect.arrayContaining([
        ['backlog', SPACE_HOST, 'projects'],
        ['backlog', SPACE_HOST, 'projects', PROJECTS[0]?.id, 'statuses'],
      ]),
    );
    expect(
      space.api.requests.every((r) => r.headerKey === VALID_API_KEY && r.queryKey === undefined),
    ).toBe(true);

    await frame.getByRole('button', { name: '閉じる' }).click();
    await expect(page.locator(CONNECT_FRAME)).toHaveCount(0);
  });

  test('不正なキーはバーの中にエラーが出て高さが変わらず、鍵は保存されない', async ({
    page,
    space,
    readStorage,
  }) => {
    await page.goto(space.url(`${API_SETTINGS_PATH}#bp-connect`));
    const { frame, section, input } = sheet(page);
    await expect(input).toBeVisible();
    const before = await section.boundingBox();

    await page.keyboard.type('wrong-key');
    await page.keyboard.press('Enter');

    await expect(frame.getByRole('alert')).toHaveText('キーが正しくありません');
    expect((await section.boundingBox())?.height).toBe(before?.height);
    expect(await readStorage('apiKeys')).toBeUndefined();
  });

  test('スペースに繋げない（429）ときは理由が「接続できませんでした」になる', async ({
    page,
    space,
  }) => {
    space.api.mode = 'rateLimited';
    await page.goto(space.url(`${API_SETTINGS_PATH}#bp-connect`));
    const { frame, input } = sheet(page);
    await expect(input).toBeVisible();

    await page.keyboard.type(VALID_API_KEY);
    await page.keyboard.press('Enter');

    await expect(frame.getByRole('alert')).toHaveText('このスペースに接続できませんでした');
  });

  test('Esc でバーが消え、埋めたメモは残る', async ({ page, space }) => {
    await page.goto(space.url(`${API_SETTINGS_PATH}#bp-connect`));
    await expect(sheet(page).input).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator(CONNECT_FRAME)).toHaveCount(0);
    await expect(page.locator(MEMO_INPUT)).toHaveValue('Backlog Palette');
  });

  test('#bp-connect が無い発行ページではバーを出さず、メモ欄にも触らない', async ({
    page,
    space,
  }) => {
    await page.goto(space.url(API_SETTINGS_PATH));
    await expect(page.locator(MEMO_INPUT)).toBeAttached();

    await expect(page.locator(CONNECT_FRAME)).toHaveCount(0);
    await expect(page.locator(MEMO_INPUT)).toHaveValue('');
  });
});
