import type { Worker } from '@playwright/test';

import { expect, test } from './fixtures/extension.ts';

/*
 * chrome-extension:// は Node の URL では special scheme ではなく origin が 'null' になる。
 * ホストから組み立てる。
 */
function optionsUrl(serviceWorker: Worker, hash = ''): string {
  return `chrome-extension://${new URL(serviceWorker.url()).host}/options.html${hash}`;
}

test.describe('設定画面', () => {
  test('options.html を開くと既定のセクションへ遷移し、1 カラムのレイアウトが描かれる', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto(optionsUrl(serviceWorker));

    await expect(page).toHaveURL(/\/options\.html#\/spaces$/u);
    await expect(page.getByRole('heading', { level: 1, name: 'Backlog Palette' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'ショートカット' })).toBeVisible();
    await expect(page.getByText(/現在の割り当て: (⌘K|Ctrl\+K)/u)).toBeVisible();
  });

  test('知らないセクションの URL は既定のセクションへ戻る', async ({ page, serviceWorker }) => {
    await page.goto(optionsUrl(serviceWorker, '#/nowhere'));

    await expect(page).toHaveURL(/#\/spaces$/u);
  });

  test('#/about を開くとバージョンと保存先の説明が見える', async ({ page, serviceWorker }) => {
    await page.goto(optionsUrl(serviceWorker, '#/about'));

    await expect(page.getByText(/^バージョン \d/u)).toBeInViewport();
    await expect(
      page.getByText('API キーは端末内の拡張機能ストレージに保存されます', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'リポジトリ' })).toHaveAttribute(
      'href',
      'https://github.com/simochee/backlog-palette',
    );
  });
});
