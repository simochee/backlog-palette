import type { Worker } from '@playwright/test';

import { expect, test } from './fixtures/extension.ts';

const SPACE_HOST = 'demo.backlog.jp';

function panelUrl(serviceWorker: Worker): string {
  return `chrome-extension://${new URL(serviceWorker.url()).host}/sidepanel.html`;
}

/** パレットの ⌘→ が書く形（entrypoints/palette/panel.ts の handOffToPanel と同じ） */
function request(query: string, projectId?: string) {
  const scope =
    projectId === undefined
      ? { kind: 'space', spaceId: SPACE_HOST }
      : { kind: 'project', spaceId: SPACE_HOST, projectId };
  return {
    panelRequest: {
      state: {
        v: 1,
        query,
        scope,
        conditions: { type: 'all', status: { kind: 'all' }, assignee: 'all', updated: 'any' },
      },
      at: Date.now(),
    },
  };
}

async function seed(serviceWorker: Worker, items: object) {
  type ChromeStorage = { storage: { local: { set: (items: object) => Promise<void> } } };
  await serviceWorker.evaluate(async (values) => {
    const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
    await api.storage.local.set(values);
  }, items);
}

/*
 * 前のテスト（palette-share.spec の ⌘→）が開いた本物のサイドパネルは worker の間ずっと
 * 残り、その watch が panelRequest を先に消費してしまう。enabled を一度落として閉じる。
 * タブで開く sidepanel.html には影響しない
 */
async function closeRealSidePanel(serviceWorker: Worker) {
  type ChromeSidePanel = {
    sidePanel: { setOptions: (options: { enabled: boolean }) => Promise<void> };
  };
  await serviceWorker.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: ChromeSidePanel }).chrome;
    await api.sidePanel.setOptions({ enabled: false });
    await api.sidePanel.setOptions({ enabled: true });
  });
}

/*
 * ⌘→ は panelRequest を書いてから sidePanel.open() を呼ぶ。開いた本物のパネルは Playwright
 * から触れないので、書く側は palette-share.spec（⌘→ → panelRequest の中身）が、受け取る側は
 * ここが検査する。境界は panelRequest の形で、両方が同じ形を前提にしている
 */
test.describe('パレットからサイドパネルへの引き渡し（surfaces.md §5.1）', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await closeRealSidePanel(serviceWorker);
  });

  test('⌘→ が書いた語とスコープでパネルが検索を起動し、受け渡しは消える', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await seed(serviceWorker, request('請求書', 'PROJ'));
    await page.goto(panelUrl(serviceWorker));

    await expect(page.getByRole('combobox', { name: '検索語' })).toHaveValue('請求書');
    await expect(page).toHaveURL(/query=%E8%AB%8B%E6%B1%82%E6%9B%B8/u);
    await expect(page).toHaveURL(/projectId/u);
    await expect(page.getByRole('button', { name: /^プロジェクト PROJ/u })).toBeVisible();
    await expect(page.getByRole('status', { name: '検索の進捗' })).toBeVisible();
    await expect.poll(() => readStorage<unknown>('panelRequest')).toBeUndefined();
  });

  test('受け渡しで開いたパネルを閉じて開き直すと、渡された検索が前回の検索として戻る', async ({
    page,
    serviceWorker,
  }) => {
    await seed(serviceWorker, request('請求書', 'PROJ'));
    await page.goto(panelUrl(serviceWorker));
    await expect(page.getByRole('combobox', { name: '検索語' })).toHaveValue('請求書');

    await page.goto('about:blank');
    await page.goto(panelUrl(serviceWorker));

    await expect(page.getByRole('combobox', { name: '検索語' })).toHaveValue('請求書');
    await expect(page.getByRole('button', { name: /^プロジェクト PROJ/u })).toBeVisible();
  });

  test('パネルが開いている間に渡し直されても、新しい語で検索を起動する', async ({
    page,
    serviceWorker,
    readStorage,
  }) => {
    await seed(serviceWorker, request('請求書', 'PROJ'));
    await page.goto(panelUrl(serviceWorker));
    await expect(page.getByRole('combobox', { name: '検索語' })).toHaveValue('請求書');

    await seed(serviceWorker, request('決済'));

    await expect(page.getByRole('combobox', { name: '検索語' })).toHaveValue('決済');
    await expect(page.getByRole('button', { name: /^プロジェクト すべて/u })).toBeVisible();
    await expect.poll(() => readStorage<unknown>('panelRequest')).toBeUndefined();
  });
});
