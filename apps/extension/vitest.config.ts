import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // 拡張 API を fakeBrowser に差し替える。storage の振る舞いを実機なしで固定できる
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
