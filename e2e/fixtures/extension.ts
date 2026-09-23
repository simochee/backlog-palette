import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  type BrowserContext,
  chromium,
  type Disposable,
  type Page,
  test as base,
  type Worker,
} from '@playwright/test';

import { VALID_API_KEY } from './api.ts';
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
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
    session: { remove: (keys: readonly string[]) => Promise<void> };
  };
};

const DISPLAY_CACHE_KEY = 'displayCache';

/** テスト間で消す item。拡張が書くものだけを列挙し、storage.local.clear() は使わない */
/** テストが書く item。テスト間で消す（Firefox の fixture も同じ一覧を消す） */
export const OWNED_KEYS = [
  DISPLAY_CACHE_KEY,
  'apiKeys',
  'spaces',
  'rateLimits',
  'queryCache',
  'activity',
  'transitions',
  'settings',
  'panelRequest',
  'searchHistory',
  'telemetry',
];

/** storage.session に書く item。ブラウザを閉じるまで残るので、worker を共有するテストの間で漏れる */
const OWNED_SESSION_KEYS = ['panelLastSearch'];

/**
 * このページに載るパレットの iframe で、storage の読み出しを遅らせる。パレットの材料
 * （createSession）は storage から作るので、材料が揃う前に開いて打つ状況を作れる。
 *
 * keys を渡すと、その item を読むときだけ遅らせる。読み出しの前に待つので、すべてを遅らせると
 * 待っている間に書いた値も読めてしまう。途中の item だけを遅らせれば、前の段で読んだ値のまま
 * 用意が止まる
 */
export function delayPaletteStorageReads(
  page: Page,
  ms: number,
  keys?: readonly string[],
): Promise<Disposable> {
  return page.addInitScript(
    ({ delay, only }) => {
      if (!location.pathname.endsWith('/palette.html')) return;
      type Area = { get: (...args: unknown[]) => Promise<unknown> };
      const area = (globalThis as unknown as { chrome: { storage: { local: Area } } }).chrome
        .storage.local;
      const read = area.get.bind(area);
      area.get = async (...args) => {
        const [query] = args;
        let requested: string[] = [];
        if (typeof query === 'string') requested = [query];
        else if (Array.isArray(query)) requested = query.map(String);
        else if (query !== null && typeof query === 'object') requested = Object.keys(query);
        if (only === undefined || requested.some((key) => only.includes(key)))
          await new Promise((done) => {
            setTimeout(done, delay);
          });
        return read(...args);
      };
    },
    { delay: ms, only: keys },
  );
}

export type ExtensionFixtures = {
  context: BrowserContext;
  page: Page;
  serviceWorker: Worker;
  readDisplayCache: () => Promise<DisplayCacheRow[]>;
  /** storage.local の item を SW 経由で読む。無ければ undefined */
  readStorage: <T>(key: string) => Promise<T | undefined>;
  /** 接続済みの状態を storage に直接置く。接続導線を通す E2E は connect.spec が持つ */
  seedConnected: (spaces: readonly { host: string; name: string }[]) => Promise<void>;
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
          // 文言は日本語の仕様（palette.md）で検査する。既定の en-US だと行のタイトルが英語になる
          locale: 'ja-JP',
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

  context: async ({ extensionBrowser, serviceWorker, space }, use) => {
    await use(extensionBrowser);
    space.api.reset();
    /*
     * 次のテストへ状態を持ち越さない。消すのは自分が書く item だけ。
     * storage.local.clear() は設定まで消し、2 件目以降のテストを壊す（mvp の罠）。
     */
    await serviceWorker.evaluate(
      async ({ local, session }) => {
        const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
        await Promise.all(local.map((key) => api.storage.local.remove(key)));
        await api.storage.session.remove(session);
      },
      { local: OWNED_KEYS, session: OWNED_SESSION_KEYS },
    );
  },

  readStorage: async ({ serviceWorker }, use) => {
    await use(async <T>(key: string) => {
      const stored = await serviceWorker.evaluate(async (name) => {
        const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
        return (await api.storage.local.get(name))[name];
      }, key);
      return stored as T | undefined;
    });
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

  seedConnected: async ({ serviceWorker }, use) => {
    await use(async (list) => {
      await serviceWorker.evaluate(
        async (input) => {
          const api = (globalThis as unknown as { chrome: ChromeStorage }).chrome;
          await api.storage.local.set({
            apiKeys: Object.fromEntries(input.list.map((s) => [s.host, input.key])),
            spaces: input.list.map((s) => ({
              host: s.host,
              name: s.name,
              spaceKey: s.host.split('.')[0],
              projectCount: 0,
              connectedAt: Date.now(),
            })),
          });
        },
        { list, key: VALID_API_KEY },
      );
    });
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
