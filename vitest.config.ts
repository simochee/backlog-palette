import { playwright } from '@vitest/browser-playwright';
import storybookTest from '@storybook/addon-vitest/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
});
