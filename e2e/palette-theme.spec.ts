import { expect, HOTKEY, PALETTE_FRAME, test } from './fixtures/extension.ts';

const DARK_MODE = () => document.documentElement.classList.add('dark-mode');

test.describe('パレットのテーマは Backlog 本体に揃う', () => {
  test('Backlog がライトならパレットもライトで開く', async ({ page, space }) => {
    await page.goto(space.url('/view/PROJ-123'));
    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();

    const root = page.frameLocator(PALETTE_FRAME).locator('html');
    await expect(root).toHaveAttribute('data-color-scheme', 'light');
  });

  test('Backlog がダークなら開く前からパレットはダークで描かれている', async ({ page, space }) => {
    await page.addInitScript(DARK_MODE);
    await page.goto(space.url('/view/PROJ-123'));

    const root = page.frameLocator(PALETTE_FRAME).locator('html');
    await expect(root).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator(PALETTE_FRAME)).toBeHidden();
  });

  test('読み込んだ後に Backlog をダークに切り替えると、次に開いたパレットはダーク', async ({
    page,
    space,
  }) => {
    await page.goto(space.url('/view/PROJ-123'));
    const root = page.frameLocator(PALETTE_FRAME).locator('html');
    await expect(root).toHaveAttribute('data-color-scheme', 'light');

    await page.evaluate(DARK_MODE);
    await page.keyboard.press(HOTKEY);
    await expect(page.locator(PALETTE_FRAME)).toBeVisible();

    await expect(root).toHaveAttribute('data-color-scheme', 'dark');
  });
});
