import { resolve } from 'node:path';

import { test as base } from '@playwright/test';
import { type Browser, type Frame, launch, type Page } from 'puppeteer';

import { OWNED_KEYS } from '../fixtures/extension.ts';
import { type ConnectProxy, startConnectProxy } from '../fixtures/proxy.ts';
import { type FakeSpace, startFakeSpace } from '../fixtures/space.ts';

const EXTENSION_PATH = resolve(import.meta.dirname, '../../.output/firefox-mv2');

export const PALETTE_FRAME = 'iframe[data-backlog-palette]';

/** 拡張は OS で修飾キーを切り替える（surfaces.md §9） */
export const HOTKEY_MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control';

export type FirefoxFixtures = {
  /** Puppeteer のタブ。Playwright 組み込みの page とは別物なので名前を分ける */
  tab: Page;
  /** パレット iframe の中のフレーム。開くまで待つ */
  paletteFrame: () => Promise<Frame>;
  /** 接続の貼り付けバーの中のフレーム。開くまで待つ */
  connectFrame: () => Promise<Frame>;
};

/*
 * BiDi は moz-extension:// のフレームの URL を about:blank と報告する。
 * frame.url() では見つからないので、フレームの中で location.href を評価して探す。
 */
async function waitForExtensionFrame(tab: Page, file: string): Promise<Frame> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    for (const frame of tab.frames()) {
      if (frame === tab.mainFrame()) continue;
      const pathname = await frame.evaluate(() => location.pathname).catch(() => '');
      if (pathname.endsWith(`/${file}`)) return frame;
    }
    await new Promise((done) => {
      setTimeout(done, 100);
    });
  }
  throw new Error(`${file} の iframe が読み込まれない`);
}

/*
 * 次のテストへ状態を持ち越さない。Firefox は Service Worker を持たないので、Backlog のページを
 * 開いて注入されるパレットの iframe（拡張ページ）の中で storage.local.remove を評価する。
 * 消すのは Chromium 側と同じ自分が書く item だけ（clear は設定まで消す、mvp の罠）
 */
async function clearOwnedStorage(tab: Page, space: FakeSpace): Promise<void> {
  await tab.goto(space.url('/dashboard'));
  const frame = await waitForExtensionFrame(tab, 'palette.html');
  await frame.evaluate(async (keys) => {
    type Storage = { storage: { local: { remove: (keys: string[]) => Promise<void> } } };
    await (globalThis as unknown as { browser: Storage }).browser.storage.local.remove(keys);
  }, OWNED_KEYS);
}

export type FirefoxWorkerFixtures = {
  space: FakeSpace;
  connectProxy: ConnectProxy;
  firefox: Browser;
};

/*
 * Playwright は Firefox に拡張を読み込めないため、ブラウザの駆動だけ Puppeteer の
 * WebDriver BiDi に任せる。テストランナーと偽スペースは Chromium 側と共有する。
 */
export const test = base.extend<FirefoxFixtures, FirefoxWorkerFixtures>({
  space: [
    async ({}, use) => {
      const space = await startFakeSpace();
      await use(space);
      await space.close();
    },
    { scope: 'worker' },
  ],

  connectProxy: [
    async ({ space }, use) => {
      const proxy = await startConnectProxy(space.port);
      await use(proxy);
      await proxy.close();
    },
    { scope: 'worker' },
  ],

  firefox: [
    async ({ connectProxy }, use) => {
      const browser = await launch({
        browser: 'firefox',
        headless: true,
        // 偽スペースの証明書は自己署名
        acceptInsecureCerts: true,
        extraPrefsFirefox: {
          'network.proxy.type': 1,
          'network.proxy.ssl': '127.0.0.1',
          'network.proxy.ssl_port': connectProxy.port,
          'network.proxy.no_proxies_on': '',
          'network.proxy.allow_hijacking_localhost': true,
        },
      });
      // ディレクトリのまま一時インストールできる。zip にする必要はない
      await browser.installExtension(EXTENSION_PATH);
      await use(browser);
      await browser.close();
    },
    { scope: 'worker' },
  ],

  tab: async ({ firefox, space }, use) => {
    const tab = await firefox.newPage();
    await use(tab);
    await clearOwnedStorage(tab, space);
    await tab.close();
  },

  paletteFrame: async ({ tab }, use) => {
    await use(() => waitForExtensionFrame(tab, 'palette.html'));
  },

  connectFrame: async ({ tab }, use) => {
    await use(() => waitForExtensionFrame(tab, 'connect.html'));
  },
});

export { expect } from '@playwright/test';
