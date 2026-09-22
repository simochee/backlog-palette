import type { Worker } from '@playwright/test';

import { expect, test } from './fixtures/extension.ts';

function panelUrl(serviceWorker: Worker): string {
  return `chrome-extension://${new URL(serviceWorker.url()).host}/sidepanel.html`;
}

async function seed(serviceWorker: Worker, items: object) {
  type ChromeStorage = { storage: { local: { set: (items: object) => Promise<void> } } };
  await serviceWorker.evaluate(async (values) => {
    const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
    await api.storage.local.set(values);
  }, items);
}

const DEMO = 'demo.backlog.jp';
const connected = {
  spaces: [{ host: DEMO, name: 'デモスペース', spaceKey: 'demo', projectCount: 2, connectedAt: 1 }],
};

test.describe('サイドパネル', () => {
  test('開くと入力欄・絞り込みの 6 項目・フッターが描かれる', async ({ page, serviceWorker }) => {
    await page.goto(panelUrl(serviceWorker));

    const panel = page.getByRole('region', { name: '詳細検索' });
    await expect(panel.getByRole('combobox', { name: '検索語' })).toBeVisible();
    for (const field of ['スペース', 'プロジェクト', '種別', 'ステータス', '担当者', '更新日']) {
      await expect(panel.getByRole('button', { name: new RegExp(`^${field}`, 'u') })).toBeVisible();
    }
  });

  test('スペースを選ぶと検索状態が URL に入り、語を打って Enter でそのスペースの API を検索する', async ({
    page,
    serviceWorker,
    seedConnected,
  }) => {
    await seedConnected([{ host: DEMO, name: 'デモスペース' }]);
    await page.goto(panelUrl(serviceWorker));

    await page.getByRole('button', { name: /^スペース/u }).click();
    await page.getByRole('radio', { name: 'デモスペース' }).click();
    await expect(page).toHaveURL(/spaceId/u);

    const input = page.getByRole('combobox', { name: '検索語' });
    await input.fill('決済');
    await input.press('Enter');

    await expect(page).toHaveURL(/%E6%B1%BA%E6%B8%88|決済/u);
    await expect(
      page.getByRole('option', { name: /決済フローのエラーハンドリング/u }),
    ).toBeVisible();
    await expect(page.getByRole('option', { name: /決済まわりの仕様メモ/u })).toBeVisible();
  });

  test('一致しない語では 0 件の案内が出る', async ({ page, serviceWorker, seedConnected }) => {
    await seedConnected([{ host: DEMO, name: 'デモスペース' }]);
    await page.goto(panelUrl(serviceWorker));
    await page.getByRole('button', { name: /^スペース/u }).click();
    await page.getByRole('radio', { name: 'デモスペース' }).click();

    const input = page.getByRole('combobox', { name: '検索語' });
    await input.fill('存在しない語');
    await input.press('Enter');

    await expect(page.getByRole('status', { name: '検索の進捗' })).toContainText('0 件');
    await expect(page.getByRole('option', { name: '一致する結果がありません' })).toBeVisible();
  });

  test('入力欄が空のとき ↑ で直前の検索語が入る', async ({ page, serviceWorker }) => {
    await seed(serviceWorker, {
      ...connected,
      searchHistory: [
        { query: 'リリース手順', scope: { kind: 'space', spaceId: DEMO }, at: 2 },
        { query: '決済', scope: { kind: 'space', spaceId: DEMO }, at: 1 },
      ],
    });
    await page.goto(panelUrl(serviceWorker));
    await page.getByRole('button', { name: /^スペース/u }).click();
    await page.getByRole('radio', { name: 'デモスペース' }).click();

    await expect(page.getByText('リリース手順')).toBeVisible();
    const input = page.getByRole('combobox', { name: '検索語' });
    await input.focus();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('リリース手順');
  });
});
