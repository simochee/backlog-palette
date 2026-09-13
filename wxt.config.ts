import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

import { BACKLOG_SPACE_MATCHES } from './lib/backlog/host.ts';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  /*
   * サイドパネルは entrypoints/sidepanel から WXT が出し分ける
   * （Chrome: side_panel + sidePanel 権限、Firefox: sidebar_action）。
   * ⌘K は content script で捕捉するので commands は置かない（D-10）。
   */
  manifest: ({ browser }) => ({
    name: 'Backlog Palette',
    description: '⌘K で Backlog のどこへでも。',
    permissions: ['storage', 'tabs', 'clipboardWrite', 'alarms'],
    // popup は持たない（D-22）。クリックは background の action.onClicked が受ける
    action: { default_title: 'Backlog Palette' },
    web_accessible_resources: [
      {
        resources: ['palette.html'],
        matches: [...BACKLOG_SPACE_MATCHES],
        // 拡張のインストール有無をページ側から検出されないようにする
        use_dynamic_url: true,
      },
    ],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // AMO の必須項目（surfaces.md §7）。ID は一度公開したら変えられない（D-23）
              id: 'backlog-palette@simochee.github.io',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    css: { transformer: 'lightningcss' },
  }),
});
