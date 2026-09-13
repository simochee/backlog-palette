import type { Worker } from '@playwright/test';

import { expect, test } from './fixtures/extension.ts';

function optionsUrl(serviceWorker: Worker, hash = ''): string {
  return `chrome-extension://${new URL(serviceWorker.url()).host}/options.html${hash}`;
}

const DEMO = 'demo.backlog.jp';
const OTHER = 'other.backlog.com';

/** 接続済みの状態を storage に直接置く。接続の導線そのものは connect.spec が検査する */
async function seedConnected(serviceWorker: Worker, needsReconnect = false) {
  type ChromeStorage = { storage: { local: { set: (items: object) => Promise<void> } } };
  await serviceWorker.evaluate(
    async (seed) => {
      const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
      await api.storage.local.set(seed);
    },
    {
      apiKeys: { [DEMO]: 'key-demo', [OTHER]: 'key-other' },
      spaces: [
        {
          host: DEMO,
          name: 'デモスペース',
          spaceKey: 'demo',
          projectCount: 2,
          connectedAt: 1_757_700_000_000,
          needsReconnect,
        },
        {
          host: OTHER,
          name: '別のスペース',
          spaceKey: 'other',
          projectCount: 5,
          connectedAt: 1_757_600_000_000,
        },
      ],
      rateLimits: { [DEMO]: { search: { limit: 150 } }, [OTHER]: { search: { limit: 150 } } },
      displayCache: [
        {
          url: `https://${DEMO}/view/PROJ-1`,
          kind: 'issue',
          spaceHost: DEMO,
          projectKey: 'PROJ',
          key: 'PROJ-1',
          visitedAt: 1,
        },
        {
          url: `https://${OTHER}/view/MOB-1`,
          kind: 'issue',
          spaceHost: OTHER,
          projectKey: 'MOB',
          key: 'MOB-1',
          visitedAt: 2,
        },
      ],
    },
  );
}

test.describe('設定画面: 接続しているスペース', () => {
  test('0 件のときは Backlog のページで ⌘K を押すよう案内する', async ({ page, serviceWorker }) => {
    await page.goto(optionsUrl(serviceWorker, '#/spaces'));

    await expect(page.getByText('Backlog のページで ⌘K を押すと', { exact: false })).toBeVisible();
  });

  test('接続済みのスペースが表示名・ホスト・プロジェクト数つきで並ぶ', async ({
    page,
    serviceWorker,
  }) => {
    await seedConnected(serviceWorker);
    await page.goto(optionsUrl(serviceWorker, '#/spaces'));

    const items = page.getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('デモスペース');
    await expect(items.first()).toContainText(`${DEMO} · 2 プロジェクト`);
    await expect(items.first()).toContainText('接続済み');
  });

  test('削除は 1 回目で確認に変わり、2 回目で鍵・スペース・レート枠・そのスペースの表示キャッシュが消える', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await seedConnected(serviceWorker);
    await page.goto(optionsUrl(serviceWorker, '#/spaces'));

    const remove = page.getByRole('button', { name: '削除: デモスペース' });
    await remove.click();
    const confirm = page.getByRole('button', { name: '本当に削除: デモスペース' });
    await expect(confirm).toBeVisible();
    expect(await readStorage<Record<string, string>>('apiKeys')).toHaveProperty([DEMO]);

    await confirm.click();

    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('listitem')).toContainText('別のスペース');
    expect(await readStorage<Record<string, string>>('apiKeys')).toEqual({ [OTHER]: 'key-other' });
    expect(await readStorage<{ host: string }[]>('spaces')).toMatchObject([{ host: OTHER }]);
    expect(Object.keys((await readStorage<Record<string, unknown>>('rateLimits')) ?? {})).toEqual([
      OTHER,
    ]);
    expect(await readStorage<{ spaceHost: string }[]>('displayCache')).toMatchObject([
      { spaceHost: OTHER },
    ]);
  });

  test('要再接続のスペースは状態が分かり、再接続で API キーの発行ページが新しいタブで開く', async ({
    page,
    serviceWorker,
    context,
  }) => {
    await seedConnected(serviceWorker, true);
    await page.goto(optionsUrl(serviceWorker, '#/spaces'));

    await expect(page.getByRole('listitem').first()).toContainText('要再接続');
    const opened = context.waitForEvent('page');
    await page.getByRole('button', { name: '再接続' }).click();

    expect((await opened).url()).toBe(`https://${DEMO}/EditApiSettings.action#bp-connect`);
  });
});
