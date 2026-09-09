import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, type Page } from '@playwright/test';
import { type FakeSpace, SPACE_HOST, startFakeSpace } from './space.ts';

const EXTENSION_PATH = resolve(import.meta.dirname, '../../apps/extension/.output/chrome-mv3');

export type ExtensionFixtures = {
  space: FakeSpace;
  context: BrowserContext;
  page: Page;
  /** パレット iframe。開いていなければ待って取得する */
  palette: () => Promise<import('@playwright/test').Frame>;
};

export const test = base.extend<ExtensionFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright のフィクスチャは第 1 引数の分割代入で依存を宣言する
  space: async ({}, use) => {
    const space = await startFakeSpace();
    await use(space);
    await space.close();
  },

  context: async ({ space }, use) => {
    /*
     * branded な Chrome ではなく Chrome for Testing を使う。
     * Chrome 137 以降 --load-extension を無視するため、拡張が入らない。
     * Playwright は既定引数に --disable-extensions を入れるので外す。
     */
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'bp-e2e-')), {
      headless: false,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        `--host-resolver-rules=MAP ${SPACE_HOST} 127.0.0.1:${space.port}`,
        '--ignore-certificate-errors',
      ],
    });

    await use(context);
    await context.close();
  },

  page: async ({ context }, use) => {
    const page = context.pages()[0] ?? (await context.newPage());
    await use(page);
  },

  palette: async ({ page }, use) => {
    await use(async () => {
      const frame = await page.waitForFunction(
        () =>
          [...document.querySelectorAll('iframe')].some((f) =>
            f.src.startsWith('chrome-extension://'),
          ),
        undefined,
        { timeout: 5_000 },
      );
      void frame;

      const found = page.frames().find((f) => f.url().includes('palette.html'));
      if (found === undefined) throw new Error('palette iframe が見つからない');
      return found;
    });
  },
});

export { expect } from '@playwright/test';
