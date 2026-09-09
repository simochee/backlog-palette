import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const BACKLOG_MATCHES = ['https://*.backlog.jp/*', 'https://*.backlog.com/*'];

/** wxt dev が起動する Chrome の専用プロファイル。cwd に依存させない */
const CHROME_PROFILE = resolve(import.meta.dirname, '.chrome-profile');

/*
 * 既定はシステムの Chrome。web-ext 10 は CDP の Extensions.loadUnpacked で
 * 拡張を入れるので、branded な Chrome でも読み込める。
 *
 * この env var は、その経路が使えない環境の逃げ道。web-ext が
 * --load-extension へフォールバックすると、branded な Chrome 137+ は
 * フラグを無視するため「ブラウザは開くが拡張が入っていない」状態になる。
 * そのときは Chrome for Testing / Chromium のパスを指定する
 * （pnpm exec playwright install chromium で入る）。
 */
const DEV_CHROME = process.env.BP_DEV_CHROME_BINARY;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // 自動 import を使わない。どのモジュールから来た関数かを読める状態を保つ
  imports: false,

  hooks: {
    /*
     * chrome-launcher は userDataDir の存在を前提に chrome-out.log を開くため、
     * ディレクトリが無いと ENOENT で起動に失敗する。WXT も web-ext も作らない。
     * server:created は dev のときだけ走るので、本番ビルドに副作用が出ない。
     */
    'server:created': () => {
      mkdirSync(CHROME_PROFILE, { recursive: true });
    },
  },

  /*
   * ブラウザの自動起動は web-ext が担う（optional peer dependency）。
   * 未インストールだと wxt dev はビルドだけして
   * 「Load ... as an unpacked extension manually」と出て終わる。
   *
   * プロファイルを使い捨てにしない。接続済みスペース・表示キャッシュ・
   * Backlog のログインセッションが再起動ごとに消えると、
   * 認証と個人化の確認に毎回 OAuth からやり直すことになる。
   */
  webExt: {
    ...(DEV_CHROME === undefined ? {} : { binaries: { chrome: DEV_CHROME } }),
    chromiumProfile: CHROME_PROFILE,
    keepProfileChanges: true,
    startUrls: process.env.BP_DEV_START_URL === undefined ? [] : [process.env.BP_DEV_START_URL],
  },

  manifest: {
    name: 'Backlog Palette',
    description: 'Cmd+K で Backlog のどこへでも。',
    permissions: ['storage', 'tabs', 'sidePanel'],
    optional_permissions: ['history'],
    host_permissions: BACKLOG_MATCHES,
    commands: {
      'open-palette': {
        suggested_key: { default: 'Ctrl+K', mac: 'Command+K' },
        description: 'Backlog Palette を開く',
      },
      'open-panel': {
        suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
        description: '検索パネルを開く',
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
  },
});
