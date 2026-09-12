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

    await expect(panel.getByText('demo')).toBeVisible({ timeout: 15_000 });

    await panel.close();
  });

  test('選んだ行の本文が右に出て、探した語がハイライトされる', async ({ context, page, space }) => {
    await connectWithApiKey(page, space);

    const panel = await openPanel(context);
    await panel.locator('input').first().click();
    await panel.keyboard.type('請求');
    await panel.keyboard.press('Enter');

    // 先頭行の件名は行とプレビューの 2 か所に出る
    await expect(panel.getByText('請求書の発行フローを見直す')).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(panel.locator('mark').first()).toHaveText('請求');

    await panel.close();
  });

  test('↑↓ で動かした行がプレビューの対象になる', async ({ context, page, space }) => {
    await connectWithApiKey(page, space);

    const panel = await openPanel(context);
    await panel.locator('input').first().click();
    await panel.keyboard.type('請求');
    await panel.keyboard.press('Enter');
    await expect(panel.getByText('請求書の発行フローを見直す')).toHaveCount(2, {
      timeout: 15_000,
    });

    await panel.keyboard.press('ArrowDown');
    await panel.keyboard.press('ArrowDown');

    await expect(panel.getByText('請求先マスタの登録画面を直す')).toHaveCount(2);
    await expect(panel.getByText('請求書の発行フローを見直す')).toHaveCount(1);

    await panel.close();
  });

  test('検索したクエリは履歴に残り、開き直すと候補として出る', async ({ context, page, space }) => {
    await connectWithApiKey(page, space);

    const panel = await openPanel(context);
    await panel.locator('input').first().click();
    await panel.keyboard.type('請求');
    await panel.keyboard.press('Enter');
    await expect(panel.getByText('請求書の発行フローを見直す').first()).toBeVisible({
      timeout: 15_000,
    });
    await panel.close();

    const reopened = await openPanel(context);
    await expect(reopened.getByText('最近の検索')).toBeVisible({ timeout: 15_000 });
    await expect(reopened.getByRole('option').filter({ hasText: '請求' })).toHaveCount(1);

    await reopened.close();
  });

  test('入力が空のとき ↑ で直前のクエリが戻る', async ({ context, page, space }) => {
    await connectWithApiKey(page, space);

    const panel = await openPanel(context);
    const input = panel.locator('input').first();
    await input.click();
    await panel.keyboard.type('請求');
    await panel.keyboard.press('Enter');
    await expect(panel.getByText('請求書の発行フローを見直す').first()).toBeVisible({
      timeout: 15_000,
    });

    await input.fill('');
    await input.press('ArrowUp');

    await expect(input).toHaveValue('請求');

    await panel.close();
  });

  test('0 件のときは効いている条件を外す提案が出る', async ({ context, page, space }) => {
    await connectWithApiKey(page, space);

    const panel = await openPanel(context);
    await panel.getByText('種別').click();
    await panel.getByRole('option', { name: '課題' }).click();

    await panel.locator('input').first().click();
    await panel.keyboard.type('みつからないことば');
    await panel.keyboard.press('Enter');

    await expect(panel.getByText('絞り込み条件を外す')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('種別「課題」を外す')).toBeVisible();

    await panel.close();
  });

  test('条件はラジオで、複数選べないことが分かる', async ({ context }) => {
    const panel = await openPanel(context);

    await panel.getByText('種別').click();
    await expect(panel.getByText('1 つだけ選べます')).toBeVisible();

    await panel.close();
  });
});
