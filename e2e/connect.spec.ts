import { expect, test } from './fixtures/extension.ts';

test.describe('API キーでの接続', () => {
  test('パレットから発行ページへ移動し、メモ欄が埋まっている', async ({ page, space, palette }) => {
    await page.goto(space.url('/dashboard'));
    await page.keyboard.press('Meta+k');

    const frame = await palette();
    await frame.locator('input').waitFor({ state: 'visible' });
    await expect(frame.getByText('このスペースを接続')).toBeVisible();
    await page.keyboard.press('Enter');

    await page.waitForURL(/EditApiSettings\.action/, { timeout: 10_000 });
    await expect(page.locator('input[name="apiKey.memo"]')).toHaveValue('Backlog Palette');
  });

  test('発行したキーを貼り付けると接続できる', async ({ page, space }) => {
    await page.goto(`${space.url('/EditApiSettings.action')}#bp-connect`);

    // 発行は利用者が行う
    await page.locator('#issue').click();
    const key = await page.locator('#keys .key').first().innerText();

    const connect = page.frames().find((f) => f.url().includes('connect.html'));
    if (connect === undefined) throw new Error('貼り付け先が出ていない');

    await connect.locator('input').fill(key);
    await connect.getByRole('button', { name: '接続' }).click();

    await expect(connect.getByText('に接続しました')).toBeVisible({ timeout: 10_000 });
  });

  test('貼り付け先はページ側の DOM に作らない', async ({ page, space }) => {
    await page.goto(`${space.url('/EditApiSettings.action')}#bp-connect`);
    await page.waitForTimeout(800);

    // ページのコンテキストからは拡張の入力欄が見えない
    const inputsInPage = await page.evaluate(
      () => document.querySelectorAll('input:not([name="apiKey.memo"])').length,
    );
    expect(inputsInPage).toBe(0);
  });

  test('合図が無ければ何も出さない', async ({ page, space }) => {
    await page.goto(space.url('/EditApiSettings.action'));
    await page.waitForTimeout(800);

    expect(page.frames().some((f) => f.url().includes('connect.html'))).toBe(false);
    await expect(page.locator('input[name="apiKey.memo"]')).toHaveValue('');
  });
});
