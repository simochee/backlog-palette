import storybookTest from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const projectRoot = new URL('.', import.meta.url).pathname;

export default defineConfig({
  test: {
    projects: [
      {
        // storybookTest は Promise を返すが、Vite はプラグイン配列内の Promise を解決するため
        // await せずに渡してよい。
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        // lib/ は React も拡張機能 API も知らない純粋ロジック。ブラウザを起こさず node で回す
        resolve: { alias: { '@': projectRoot } },
        test: {
          name: 'lib',
          include: ['lib/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
