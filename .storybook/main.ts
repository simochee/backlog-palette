import type { StorybookConfig } from '@storybook/react-vite';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

const config: StorybookConfig = {
  stories: ['../{components,entrypoints}/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (viteConfig) => {
    viteConfig.plugins ??= [];
    // vitest 専用に見えるが、実体は wxt.config.ts から `#imports` の解決・パスエイリアス・
    // 拡張機能 API のモックを組み立てる汎用 Vite プラグイン。手書きの alias で代用すると
    // wxt.config.ts の変更に追従できなくなるため、これを使う。
    viteConfig.plugins.push(await WxtVitest());
    return viteConfig;
  },
};

export default config;
