import { expect, PALETTE_FRAME, test } from './fixtures/extension.ts';

test.describe('表示キャッシュの収集', () => {
  test('課題ページを開くと URL・課題キー・件名が表示キャッシュに記録される', async ({
    page,
    space,
    readDisplayCache,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));

    await expect.poll(readDisplayCache).toMatchObject([
      {
        url: space.url('/view/PROJ-123'),
        kind: 'issue',
        spaceKey: 'demo',
        projectKey: 'PROJ',
        key: 'PROJ-123',
        title: 'ログイン画面のバリデーション修正',
      },
    ]);
  });

  test('件名の形式が合わないページでは課題キーだけを記録する', async ({
    page,
    space,
    readDisplayCache,
  }) => {
    await page.goto(space.url('/view/PROJ-999'));

    await expect.poll(readDisplayCache).toMatchObject([{ key: 'PROJ-999' }]);
    const [entry] = await readDisplayCache();
    expect(entry).not.toHaveProperty('title');
  });

  test('同じ URL を開き直しても 1 件にまとまり、新しい訪問が先頭になる', async ({
    page,
    space,
    readDisplayCache,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await expect.poll(readDisplayCache).toHaveLength(1);
    await page.goto(space.url('/view/PROJ-142'));
    await expect.poll(readDisplayCache).toHaveLength(2);
    await page.goto(space.url('/view/PROJ-123'));

    await expect
      .poll(async () => (await readDisplayCache()).map((entry) => entry.key))
      .toEqual(['PROJ-123', 'PROJ-142']);
  });

  test('表示キャッシュに載せない画面（ダッシュボード）は記録しない', async ({
    page,
    space,
    readDisplayCache,
  }) => {
    await page.goto(space.url('/dashboard'));
    await expect(page.locator(PALETTE_FRAME)).toBeAttached();

    expect(await readDisplayCache()).toEqual([]);
  });
});
