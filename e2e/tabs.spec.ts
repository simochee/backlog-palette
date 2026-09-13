import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

test.describe('拡張ページからの tabs API', () => {
  test('パレットを開くと、ページに埋めた iframe が自分のタブ URL からスペースを決める', async ({
    page,
    space,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);

    const input = page.frameLocator(PALETTE_FRAME).locator('input');
    await expect(input).toHaveAttribute('placeholder', 'demo.backlog.jp で検索');
  });
});
