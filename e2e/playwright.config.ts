import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // 拡張を読み込むブラウザは 1 プロファイル 1 インスタンスなので直列で回す
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testMatch: '**/*.spec.ts', testIgnore: 'firefox/**' },
    // Firefox は Puppeteer で駆動する（firefox/fixtures.ts）。Playwright の trace は取れない
    { name: 'firefox', testMatch: 'firefox/**/*.spec.ts', use: { trace: 'off' } },
  ],
});
