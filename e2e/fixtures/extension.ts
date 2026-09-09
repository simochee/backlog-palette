import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  type BrowserContext,
  test as base,
  chromium,
  type Frame,
  type Page,
} from '@playwright/test';
import { type FakeSpace, SPACE_HOST, startFakeSpace } from './space.ts';

const EXTENSION_PATH = resolve(import.meta.dirname, '../../apps/extension/.output/chrome-mv3');

type ChromeStorage = { storage: { local: { clear: () => Promise<void> } } };

export type ExtensionFixtures = {
  context: BrowserContext;
  page: Page;
  /** パレット iframe。開いていなければ待って取得する */
  palette: () => Promise<Frame>;
};

export type WorkerFixtures = {
  space: FakeSpace;
  extensionBrowser: BrowserContext;
};

/*
 * ブラウザとサーバは worker ごとに 1 回だけ起動する。テストごとに立ち上げると
 * 起動コストが支配的になり、拡張の読み込みも毎回やり直しになる。
 * 代わりに、テストごとにストレージを消して状態を切り離す。
 */
export const test = base.extend<ExtensionFixtures, WorkerFixtures>({
  space: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright のフィクスチャは第 1 引数の分割代入で依存を宣言する
    async ({}, use) => {
      const space = await startFakeSpace();
      await use(space);
      await space.close();
    },
    { scope: 'worker' },
  ],

  extensionBrowser: [
    async ({ space }, use) => {
      /*
       * 既定の headless は Chrome Headless Shell を使い、拡張を読み込めない。
       * channel を 'chromium' にすると完全なブラウザの新ヘッドレスになり、
       * 拡張が動く。ウィンドウが出ないのでフォーカスも奪わない。
       *
       * branded な Chrome は 137 以降 --load-extension を無視する。
       * Playwright は既定引数に --disable-extensions を入れるので外す。
       */
      const context = await chromium.launchPersistentContext(
        mkdtempSync(join(tmpdir(), 'bp-e2e-')),
        {
          channel: 'chromium',
          headless: true,
          ignoreDefaultArgs: ['--disable-extensions'],
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            `--host-resolver-rules=MAP ${SPACE_HOST} 127.0.0.1:${space.port}`,
            '--ignore-certificate-errors',
          ],
        },
      );

      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  context: async ({ extensionBrowser }, use) => {
    await use(extensionBrowser);

    // 次のテストへ状態を持ち越さない。表示キャッシュは永続なので必ず消す
    const worker = extensionBrowser.serviceWorkers()[0];
    await worker
      ?.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
        await api.storage.local.clear();
      })
      .catch(() => {});
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },

  palette: async ({ page }, use) => {
    await use(async () => {
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('iframe')].some((f) =>
            f.src.startsWith('chrome-extension://'),
          ),
        undefined,
        { timeout: 5_000 },
      );

      const found = page.frames().find((f) => f.url().includes('palette.html'));
      if (found === undefined) throw new Error('palette iframe が見つからない');
      return found;
    });
  },
});

export { expect } from '@playwright/test';
