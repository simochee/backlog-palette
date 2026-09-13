import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

test.describe('拡張ページからの tabs API', () => {
  test('パレットを開くと、ページに埋めた iframe が自分のタブ URL からスペースを決める', async ({
    page,
    space,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);

    // スコープパスの先頭の段がタブ URL から決めたスペース。未接続なので表示名はホストのまま
    const path = page.frameLocator(PALETTE_FRAME).locator('ol li').first();
    await expect(path).toContainText('demo.backlog.jp');
  });
});
