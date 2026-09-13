import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

/*
 * 言語は設定で上書きできる（surfaces.md §9・D-11）。ブラウザは ja-JP で起動しているので、
 * 設定を English にしたときだけ英語になれば、ブラウザ言語 → 設定の優先順が検査できる。
 */
test.describe('言語（surfaces.md §9）', () => {
  test('設定の言語を English にするとパレットの行とフッターが英語になる', async ({
    page,
    space,
    seedSettings,
  }) => {
    await seedSettings({ language: 'en' });
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);
    const frame = page.frameLocator(PALETTE_FRAME);
    await expect(frame.getByRole('combobox')).toBeFocused();

    await expect(
      frame.getByRole('option').filter({ has: frame.getByTitle('Board', { exact: true }) }),
    ).toBeVisible();
    await expect(frame.getByText('Open', { exact: true }).first()).toBeVisible();
    await expect(frame.getByTitle('ボード', { exact: true })).toHaveCount(0);
  });
});
