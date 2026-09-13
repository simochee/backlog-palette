import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig, type Plugin } from 'vite';

const projectRoot = new URL('..', import.meta.url).pathname;

const rejectExtensionApi: Plugin = {
  name: 'backlog-palette:reject-extension-api',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source !== '#imports' && !source.startsWith('wxt/')) return null;

    throw new Error(
      [
        `components/ から拡張機能 API (${source}) を import しています: ${importer ?? '?'}`,
        'components/ は props だけを受け取る presenter 層です。',
        'browser API を使う処理は lib/ に置き、entrypoints/ から props として渡してください。',
      ].join('\n'),
    );
  },
};

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // WXT の Vite プラグイン (`WxtVitest()`) はあえて読み込まない。読み込むと `#imports` が
  // fakeBrowser に解決できてしまい、presenter 層への拡張機能 API 混入が Storybook 上で
  // 動いてしまう。解決不能にしておくことで規約違反をビルドエラーとして検出する。
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [rejectExtensionApi],
      resolve: {
        alias: {
          '@': projectRoot,
          '@@': projectRoot,
          '~': projectRoot,
          '~~': projectRoot,
        },
      },
    }),
};

export default config;
