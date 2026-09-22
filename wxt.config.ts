import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

import { reactCompiler } from './react-compiler.config.ts';

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
    permissions: ['storage', 'tabs', 'clipboardWrite', 'alarms', 'scripting'],
    /*
     * Enterprise のカスタムドメイン（surfaces.md §8）は利用者が設定画面で足すので、
     * 任意の https ホストを任意の権限として宣言し、登録時に permissions.request で求める。
     * optional_host_permissions は MV3 のキーで、Firefox（MV2）は optional_permissions に載せる
     */
    ...(browser === 'firefox'
      ? { optional_permissions: ['https://*/*'] }
      : { optional_host_permissions: ['https://*/*'] }),
    // popup は持たない（D-22）。クリックは background の action.onClicked が受ける
    action: { default_title: 'Backlog Palette' },
    web_accessible_resources: [
      {
        resources: ['palette.html', 'connect.html'],
        /*
         * カスタムドメインのページでも iframe を読めるように https 全体に開く（D-34）。
         * matches は実行時に変えられない。ページ側からの検出は use_dynamic_url が防ぐ
         */
        matches: ['https://*/*'],
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
    plugins: [tailwindcss(), reactCompiler()],
    css: { transformer: 'lightningcss' },
  }),
});
