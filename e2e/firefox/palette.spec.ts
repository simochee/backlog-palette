import { expect, HOTKEY_MODIFIER, PALETTE_FRAME, test } from './fixtures.ts';

test.describe('Firefox: パレットの注入と開閉', () => {
  test('Backlog のページを開くと拡張の iframe が非表示で注入される', async ({
    tab,
    space,
    paletteFrame,
  }) => {
    await tab.goto(space.url('/view/PROJ-123'));

    const iframe = await tab.waitForSelector(PALETTE_FRAME, { timeout: 5000 });
    expect(await iframe?.evaluate((el) => el.getAttribute('src'))).toMatch(
      /^moz-extension:\/\/.+\/palette\.html\?colorScheme=light$/u,
    );
    expect(await iframe?.evaluate((el) => (el as HTMLElement).style.display)).toBe('none');
    // 中身が読み込まれていること。about:blank のまま止まっていない
    await paletteFrame();
  });

  test('⌘K で iframe が表示され、打った文字がパレットの入力欄に入る', async ({
    tab,
    space,
    paletteFrame,
  }) => {
    await tab.goto(space.url('/view/PROJ-123'));
    const frame = await paletteFrame();

    await tab.keyboard.down(HOTKEY_MODIFIER);
    await tab.keyboard.press('k');
    await tab.keyboard.up(HOTKEY_MODIFIER);

    await tab.waitForSelector(`${PALETTE_FRAME}[style*="display: block"]`, { timeout: 5000 });
    await tab.keyboard.type('board');
    await frame.waitForFunction(() => document.querySelector('input')?.value === 'board', {
      timeout: 5000,
    });
    expect(await tab.$eval('#page-input', (el) => (el as HTMLInputElement).value)).toBe('');
  });

  /*
   * Firefox の埋め込み iframe には browser.tabs が無く、background への委譲で
   * タブ URL を読む（backlog-facts.md §5-16）。Chrome の tabs.spec と同じ検査で I7 の経路を固定する
   */
  test('パレットを開くと、iframe が background 経由で自分のタブ URL からスペースを決める', async ({
    tab,
    space,
    paletteFrame,
  }) => {
    await tab.goto(space.url('/view/PROJ-123'));
    const frame = await paletteFrame();

    await tab.keyboard.down(HOTKEY_MODIFIER);
    await tab.keyboard.press('k');
    await tab.keyboard.up(HOTKEY_MODIFIER);

    // スコープパスの先頭の段がタブ URL から決めたスペース。未接続なのでホスト名
    await frame.waitForFunction(
      () => document.querySelector('ol li')?.textContent?.includes('demo.backlog.jp') === true,
      { timeout: 5000 },
    );
  });

  test('Esc で閉じる', async ({ tab, space, paletteFrame }) => {
    await tab.goto(space.url('/view/PROJ-123'));
    await paletteFrame();

    await tab.keyboard.down(HOTKEY_MODIFIER);
    await tab.keyboard.press('k');
    await tab.keyboard.up(HOTKEY_MODIFIER);
    await tab.waitForSelector(`${PALETTE_FRAME}[style*="display: block"]`, { timeout: 5000 });

    await tab.keyboard.press('Escape');
    await tab.waitForSelector(`${PALETTE_FRAME}[style*="display: none"]`, { timeout: 5000 });
  });
});
