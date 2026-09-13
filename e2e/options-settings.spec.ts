import type { Worker } from '@playwright/test';

import { expect, test } from './fixtures/extension.ts';

function optionsUrl(serviceWorker: Worker, hash = ''): string {
  return `chrome-extension://${new URL(serviceWorker.url()).host}/options.html${hash}`;
}

async function seed(serviceWorker: Worker, items: object) {
  type ChromeStorage = { storage: { local: { set: (items: object) => Promise<void> } } };
  await serviceWorker.evaluate(async (values) => {
    const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
    await api.storage.local.set(values);
  }, items);
}

test.describe('設定画面: 表示・学習・履歴', () => {
  test('配色を変えると即反映され、設定に書き戻される', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await page.goto(optionsUrl(serviceWorker, '#/display'));
    const scheme = page.locator('html');
    await expect(scheme).toHaveAttribute('data-color-scheme', /^(light|dark)$/u);

    await page.getByRole('radio', { name: 'ダーク' }).click();
    await expect(scheme).toHaveAttribute('data-color-scheme', 'dark');
    await page.getByRole('radio', { name: 'ライト' }).click();
    await expect(scheme).toHaveAttribute('data-color-scheme', 'light');

    await expect
      .poll(() => readStorage<{ theme: string }>('settings'))
      .toMatchObject({ theme: 'light' });
  });

  test('言語を English にすると文言が切り替わる', async ({ page, serviceWorker }) => {
    await page.goto(optionsUrl(serviceWorker, '#/display'));

    await page.getByRole('radio', { name: 'English' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Connected spaces' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Appearance' })).toBeVisible();
    await page.getByRole('radio', { name: '日本語' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '表示' })).toBeVisible();
  });

  test('並び順の学習をオフにすると設定に書き戻される', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await page.goto(optionsUrl(serviceWorker, '#/learning'));

    const toggle = page.getByRole('switch', { name: '並び順の学習' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect
      .poll(() => readStorage<{ learning: boolean }>('settings'))
      .toMatchObject({
        learning: false,
      });
  });

  test('履歴消去は 1 回目で確認、2 回目で表示キャッシュと行動ログが空になり apiKeys は残る', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await seed(serviceWorker, {
      apiKeys: { 'demo.backlog.jp': 'key-demo' },
      displayCache: [
        {
          url: 'https://demo.backlog.jp/view/PROJ-1',
          kind: 'issue',
          spaceHost: 'demo.backlog.jp',
          projectKey: 'PROJ',
          key: 'PROJ-1',
          visitedAt: 1,
        },
      ],
      activity: [{ entityId: 'issue:PROJ-1', at: 1 }],
    });
    await page.goto(optionsUrl(serviceWorker, '#/learning'));

    await page.getByRole('button', { name: '消去', exact: true }).click();
    const confirm = page.getByRole('button', { name: '本当に消去' });
    await expect(confirm).toBeVisible();
    expect(await readStorage<unknown[]>('displayCache')).toHaveLength(1);

    await confirm.click();

    await expect(page.getByRole('button', { name: '消去しました' })).toBeDisabled();
    expect(await readStorage<unknown[]>('displayCache')).toEqual([]);
    expect(await readStorage<unknown[]>('activity')).toEqual([]);
    expect(await readStorage<Record<string, string>>('apiKeys')).toEqual({
      'demo.backlog.jp': 'key-demo',
    });
  });

  test('カスタムドメインを追加すると保存され、削除で消える', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await page.goto(optionsUrl(serviceWorker, '#/custom-domain'));

    await page.getByLabel('ホスト名').fill('Backlog.Example.co.jp');
    await page.getByRole('button', { name: '追加' }).click();

    await expect(page.getByText('backlog.example.co.jp')).toBeVisible();
    await expect
      .poll(() => readStorage<string[]>('customHosts'))
      .toEqual(['backlog.example.co.jp']);

    await page.getByRole('button', { name: /^削除: backlog\.example\.co\.jp/u }).click();
    await expect.poll(() => readStorage<string[]>('customHosts')).toEqual([]);
  });

  test('ブラウザ履歴の取り込みは権限が無い間はオフで、利用状況の送信は既定オン', async ({
    page,
    serviceWorker,
  }) => {
    await page.goto(optionsUrl(serviceWorker, '#/history'));

    await expect(
      page.getByRole('switch', { name: 'ブラウザ履歴から最近の課題を取り込む' }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: '利用状況の送信' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
