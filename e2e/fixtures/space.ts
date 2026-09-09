import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import selfsigned from 'selfsigned';

export const SPACE_HOST = 'demo.backlog.jp';

/**
 * Backlog のスペースに見せかけたローカルサーバ。
 *
 * 本物のスペースに繋ぐと認証と実データに依存して壊れるので、閉じた環境で回す。
 * content script の matches は https のスペースにしか当たらないため、
 * Chrome の --host-resolver-rules でこのサーバを demo.backlog.jp として見せる。
 */
export type FakeSpace = {
  port: number;
  url: (path: string) => string;
  close: () => Promise<void>;
};

const PAGES: Record<string, string> = {
  '/view/PROJ-123': 'ログイン画面のバリデーション修正 | Webリニューアル',
  '/view/PROJ-142': '決済フローのエラーハンドリング | Webリニューアル',
  '/board/PROJ': 'ボード | Webリニューアル',
  '/dashboard': 'ダッシュボード',
};

export async function startFakeSpace(): Promise<FakeSpace> {
  /*
   * 鍵長とハッシュを明示する。selfsigned の既定は Chrome が
   * ERR_SSL_VERSION_OR_CIPHER_MISMATCH で拒む強度になる。
   */
  const pems = await selfsigned.generate([{ name: 'commonName', value: SPACE_HOST }], {
    notAfterDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: SPACE_HOST }] }],
  });

  const server: Server = createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const title = PAGES[path] ?? 'ダミー | Webリニューアル';

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title></head>` +
        `<body><h1>${title}</h1><input id="page-input" placeholder="ページ側の入力欄"></body></html>`,
    );
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    url: (path) => `https://${SPACE_HOST}${path}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
