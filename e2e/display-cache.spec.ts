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

  test('Wiki のページ名とドキュメント ID は大文字小文字をそのまま記録する', async ({
    page,
    space,
    readDisplayCache,
  }) => {
    await page.goto(space.url('/wiki/PROJ/Home'));
    await expect.poll(readDisplayCache).toHaveLength(1);
    await page.goto(space.url('/document/PROJ/abcDEF0123'));
    await expect.poll(readDisplayCache).toHaveLength(2);

    expect(await readDisplayCache()).toMatchObject([
      { kind: 'document', projectKey: 'PROJ', key: 'abcDEF0123' },
      { kind: 'wiki', projectKey: 'PROJ', key: 'Home' },
    ]);
  });

  test('Wiki のページ名はパーセントエンコードを戻して記録し、URL は元のまま残す', async ({
    page,
    space,
    readDisplayCache,
  }) => {
    const path = `/wiki/PROJ/${encodeURIComponent('リリース手順')}/Sub Page`;
    await page.goto(space.url(path));

    await expect
      .poll(readDisplayCache)
      .toMatchObject([
        { kind: 'wiki', key: 'リリース手順/Sub Page', url: space.url(path).replace(' ', '%20') },
      ]);
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
