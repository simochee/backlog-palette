import { defineConfig } from 'wxt';

const BACKLOG_MATCHES = ['https://*.backlog.jp/*', 'https://*.backlog.com/*'];

export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-react'],
  // 自動 import を使わない。どのモジュールから来た関数かを読める状態を保つ
  imports: false,
  manifest: ({ browser }) => ({
    name: 'Backlog Palette',
    description: 'Cmd+K で Backlog のどこへでも。',
    permissions: ['storage', 'tabs', ...(browser === 'chrome' ? ['sidePanel'] : [])],
    optional_permissions: ['history'],
    host_permissions: BACKLOG_MATCHES,
    commands: {
      'open-palette': {
        suggested_key: { default: 'Ctrl+K', mac: 'Command+K' },
        description: 'Backlog Palette を開く',
      },
    },
    web_accessible_resources: [
      {
        resources: ['palette.html'],
        matches: BACKLOG_MATCHES,
        // 拡張のインストール有無をページ側から検出されないようにする
        use_dynamic_url: true,
      },
    ],
  }),
});
