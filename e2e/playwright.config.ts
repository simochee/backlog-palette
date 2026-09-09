import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  // 拡張を読み込む Chromium は 1 プロファイル 1 インスタンスなので直列で回す
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure' },
});
