import { resolve } from 'node:path';

import { test as base } from '@playwright/test';
import { type Browser, type Frame, launch, type Page } from 'puppeteer';

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
};

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

  tab: async ({ firefox }, use) => {
    const tab = await firefox.newPage();
    await use(tab);
    await tab.close();
  },

  paletteFrame: async ({ tab }, use) => {
    await use(async () => {
      /*
       * BiDi は moz-extension:// のフレームの URL を about:blank と報告する。
       * frame.url() では見つからないので、フレームの中で location.href を評価して探す。
       */
      for (let attempt = 0; attempt < 50; attempt += 1) {
        for (const frame of tab.frames()) {
          if (frame === tab.mainFrame()) continue;
          const href = await frame.evaluate(() => location.href).catch(() => '');
          if (href.endsWith('/palette.html')) return frame;
        }
        await new Promise((done) => {
          setTimeout(done, 100);
        });
      }
      throw new Error('palette iframe が読み込まれない');
    });
  },
});

export { expect } from '@playwright/test';
