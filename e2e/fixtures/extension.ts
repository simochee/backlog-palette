import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  type BrowserContext,
  chromium,
  type Page,
  test as base,
  type Worker,
} from '@playwright/test';

import { type FakeSpace, HOSTS, startFakeSpace } from './space.ts';

const EXTENSION_PATH = resolve(import.meta.dirname, '../../.output/chrome-mv3');

export const PALETTE_FRAME = 'iframe[data-backlog-palette]';

/** パレットを開閉するキー。拡張は OS で修飾キーを切り替える（surfaces.md §9） */
export const HOTKEY = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';

/** storage に書いた表示キャッシュ。E2E は SW 経由で読む */
export type DisplayCacheRow = {
  url: string;
  kind: string;
  spaceKey: string;
  projectKey: string;
  key?: string;
  title?: string;
  visitedAt: number;
};

type ChromeStorage = {
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, unknown>>;
      remove: (key: string) => Promise<void>;
    };
  };
};

const DISPLAY_CACHE_KEY = 'displayCache';

export type ExtensionFixtures = {
  context: BrowserContext;
  page: Page;
  serviceWorker: Worker;
  readDisplayCache: () => Promise<DisplayCacheRow[]>;
};

export type WorkerFixtures = {
  space: FakeSpace;
  extensionBrowser: BrowserContext;
};

/*
 * ブラウザとサーバは worker ごとに 1 回だけ起動する。テストごとに立ち上げると
 * 起動コストが支配的になり、拡張の読み込みも毎回やり直しになる。
 */
export const test = base.extend<ExtensionFixtures, WorkerFixtures>({
  space: [
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
       * 拡張が動く。
       *
       * Playwright は既定引数に --disable-extensions を入れるので外す。
       * branded な Chrome は 137 以降 --load-extension を無視するため、
       * Playwright が入れる Chromium（Chrome for Testing 相当）を使う。
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
            `--host-resolver-rules=${HOSTS.map((h) => `MAP ${h} 127.0.0.1:${space.port}`).join(', ')}`,
            '--ignore-certificate-errors',
          ],
        },
      );

      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  serviceWorker: async ({ extensionBrowser }, use) => {
    const worker =
      extensionBrowser.serviceWorkers()[0] ??
      (await extensionBrowser.waitForEvent('serviceworker'));
    await use(worker);
  },

  context: async ({ extensionBrowser, serviceWorker }, use) => {
    await use(extensionBrowser);
    /*
     * 次のテストへ状態を持ち越さない。消すのは自分が書く item だけ。
     * storage.local.clear() は設定まで消し、2 件目以降のテストを壊す（mvp の罠）。
     */
    await serviceWorker.evaluate(async (key) => {
      const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
      await api.storage.local.remove(key);
    }, DISPLAY_CACHE_KEY);
  },

  readDisplayCache: async ({ serviceWorker }, use) => {
    await use(async () => {
      const rows = await serviceWorker.evaluate(async (key) => {
        const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
        const stored = await api.storage.local.get(key);
        return stored[key] ?? [];
      }, DISPLAY_CACHE_KEY);
      return rows as DisplayCacheRow[];
    });
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
