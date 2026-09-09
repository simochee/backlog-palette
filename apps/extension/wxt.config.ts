import { defineConfig } from 'wxt';

const BACKLOG_MATCHES = ['https://*.backlog.jp/*', 'https://*.backlog.com/*'];

export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-react'],

  /*
   * ブラウザの自動起動は web-ext が担う（optional peer dependency）。
   * 未インストールだと wxt dev はビルドだけして
   * 「Load ... as an unpacked extension manually」と出て終わる。
   *
   * プロファイルを使い捨てにしない。接続済みスペース・表示キャッシュ・
   * Backlog のログインセッションが再起動ごとに消えると、
   * 認証と個人化の確認に毎回 OAuth からやり直すことになる。
   *
   * ディレクトリは dev スクリプトが先に作る。chrome-launcher は
   * userDataDir の存在を前提に chrome-out.log を開くため、
   * 無いと ENOENT で起動に失敗する。
   */
  webExt: {
    chromiumProfile: '.chrome-profile',
    keepProfileChanges: true,
    startUrls: process.env.BP_DEV_START_URL === undefined ? [] : [process.env.BP_DEV_START_URL],
  },

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
