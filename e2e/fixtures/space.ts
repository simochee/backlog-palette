import { createServer, type Server } from 'node:https';

import selfsigned from 'selfsigned';

import { createFakeApi, type FakeApi, handleApi } from './api.ts';

export const SPACE_HOST = 'demo.backlog.jp';

/** スペースではないホスト。content script の excludeMatches が効くことを見る */
export const NOT_A_SPACE_HOST = 'www.backlog.jp';

/** Backlog と無関係なホスト。matches に当たらないことを見る */
export const OTHER_HOST = 'other.example';

export const HOSTS = [SPACE_HOST, NOT_A_SPACE_HOST, OTHER_HOST] as const;

/**
 * Backlog のスペースに見せかけたローカルサーバ。
 *
 * 本物のスペースに繋ぐと認証と実データに依存して壊れるので、閉じた環境で回す。
 * content script の matches は https のスペースにしか当たらないため、
 * Chrome の --host-resolver-rules でこのサーバを demo.backlog.jp として見せる。
 */
export type FakeSpace = {
  port: number;
  url: (path: string, host?: (typeof HOSTS)[number]) => string;
  /** Backlog API の偽エンドポイント。鍵の検査・401 / 429 の切り替え・受けたリクエストの記録 */
  api: FakeApi;
  close: () => Promise<void>;
};

const PAGES: Record<string, string> = {
  '/view/PROJ-123': 'ログイン画面のバリデーション修正 | Webリニューアル',
  '/view/PROJ-142': '決済フローのエラーハンドリング | Webリニューアル',
  '/board/PROJ': 'ボード | Webリニューアル',
  // 件名の形式（' | ' 区切り）に合わない title。課題キーだけが記録される場面を再現する
  '/view/PROJ-999': 'Backlog',
  '/dashboard': 'ダッシュボード',
  '/EditApiSettings.action': 'API の設定 | 個人設定',
};

/**
 * API キーの発行ページ。メモ欄のフォームは 300ms 後に描く。content script の
 * 一度きりの探索では見つからない状況（surfaces.md §1.1）を再現する。
 */
export const API_SETTINGS_PATH = '/EditApiSettings.action';
export const MEMO_INPUT = '#apiKey-memo';
const API_SETTINGS_BODY =
  `<div id="api-settings"></div><script>setTimeout(() => {` +
  `document.getElementById('api-settings').innerHTML = '<form><label for="apiKey-memo">メモ</label>` +
  `<input type="text" id="apiKey-memo" name="apiKey.memo"><button type="button">登録</button></form>';` +
  `}, 300)</script>`;

const BODIES: Record<string, string> = { [API_SETTINGS_PATH]: API_SETTINGS_BODY };

function pageHtml(title: string, body = ''): string {
  return (
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title></head>` +
    `<body><h1>${title}</h1><input id="page-input" placeholder="ページ側の入力欄">` +
    `<textarea id="page-textarea"></textarea>${body}</body></html>`
  );
}

export async function startFakeSpace(): Promise<FakeSpace> {
  /*
   * 鍵長とハッシュを明示する。selfsigned の既定は Chrome が
   * ERR_SSL_VERSION_OR_CIPHER_MISMATCH で拒む強度になる。
   * generate は v5 で async になった。await を忘れると空のオブジェクトが返る。
   */
  const pems = await selfsigned.generate([{ name: 'commonName', value: SPACE_HOST }], {
    notAfterDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'subjectAltName', altNames: HOSTS.map((host) => ({ type: 2, value: host })) },
    ],
  });

  const api = createFakeApi();
  const server: Server = createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    const url = new URL(req.url ?? '/', `https://${SPACE_HOST}`);
    if (handleApi(api, req, res, url)) return;
    const title = PAGES[url.pathname] ?? 'ダミー | Webリニューアル';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(pageHtml(title, BODIES[url.pathname]));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('TCP ポートが取れない');
  const { port } = address;

  return {
    port,
    api,
    url: (path, host = SPACE_HOST) => `https://${host}${path}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
