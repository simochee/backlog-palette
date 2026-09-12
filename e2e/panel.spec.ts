import { connectWithApiKey } from './fixtures/connect.ts';
import { expect, test } from './fixtures/extension.ts';

/**
 * サイドパネルは拡張ページなので、タブで直接開いて検証する。
 * sidePanel API はユーザー操作起点でしか開けず、テストから駆動できない。
 */
async function openPanel(context: import('@playwright/test').BrowserContext) {
  // MV3 の Service Worker は遅延起動なので、まだ立っていなければ待つ
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  return page;
}

test.describe('サイドパネル', () => {
  test('検索フィールドとフィルターが出る', async ({ context }) => {
    const panel = await openPanel(context);

    await expect(panel.locator('input').first()).toBeVisible();
    await expect(panel.getByText('条件はすべて AND')).toBeVisible();
    await expect(panel.getByText('検索 URL をコピー')).toBeVisible();

    await panel.close();
  });

  test('入力して Enter を押すと検索が走り、スペースの状態が出る', async ({
    context,
    page,
    space,
  }) => {
    await connectWithApiKey(page, space);

    const panel = await openPanel(context);
    await panel.locator('input').first().click();
    await panel.keyboard.type('請求');
    await panel.keyboard.press('Enter');

    // 偽スペースは空の結果を返すので、スペースの状態が出れば経路は通っている
    await expect(panel.getByText('demo')).toBeVisible({ timeout: 15_000 });

    await panel.close();
  });

  test('条件はラジオで、複数選べないことが分かる', async ({ context }) => {
    const panel = await openPanel(context);

    await panel.getByText('種別').click();
    await expect(panel.getByText('1 つだけ選べます')).toBeVisible();

    await panel.close();
  });
});
