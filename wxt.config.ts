import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

import { BACKLOG_SPACE_MATCHES } from './lib/backlog/host.ts';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: {
    name: 'Backlog Palette',
    permissions: ['storage', 'tabs', 'clipboardWrite'],
    web_accessible_resources: [
      {
        resources: ['palette.html'],
        matches: [...BACKLOG_SPACE_MATCHES],
        // 拡張のインストール有無をページ側から検出されないようにする
        use_dynamic_url: true,
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { transformer: 'lightningcss' },
  }),
});
