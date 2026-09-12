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

/** API キーの発行ページ。メモ欄と発行済みキーの一覧を持つ */
const API_SETTINGS_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>API | 個人設定</title></head><body><h1>API</h1>
<form id="api-form"><label>メモ <input type="text" name="apiKey.memo"></label>
<button type="button" id="issue">登録</button></form>
<table id="keys"></table>
<script>
document.getElementById('issue').addEventListener('click', () => {
  const memo = document.querySelector('input[name="apiKey.memo"]').value;
  const row = document.createElement('tr');
  row.innerHTML = '<td class="memo"></td><td class="key">test-api-key</td>';
  row.querySelector('.memo').textContent = memo;
  document.getElementById('keys').appendChild(row);
});
</script></body></html>`;

/*
 * API と OAuth もこのサーバで受ける。
 *
 * クライアント ID が設定されていると launchWebAuthFlow は実際に認可画面を
 * 開きに行くので、応答しないサーバだとテストが待ち続ける（実際に踏んだ）。
 * 認可の応答まで返せて初めて、接続の経路をテストとして回せる。
 */
const RATE_LIMIT = {
  rateLimit: {
    read: { limit: 600, remaining: 599, reset: 0 },
    update: { limit: 150, remaining: 150, reset: 0 },
    search: { limit: 150, remaining: 150, reset: 0 },
    icon: { limit: 60, remaining: 60, reset: 0 },
  },
};

const TESTER = { id: 1, userId: 'tester', name: 'テスト太郎' };

function issue(keyId: number, summary: string, description: string) {
  return {
    id: 1000 + keyId,
    projectId: 101,
    issueKey: `PROJ-${keyId}`,
    keyId,
    summary,
    description,
    issueType: { id: 1, projectId: 101, name: 'タスク', color: '#7ea800' },
    status: { id: 1, projectId: 101, name: '未対応', color: '#ed8077', displayOrder: 1000 },
    priority: { id: 3, name: '中' },
    assignee: TESTER,
    createdUser: TESTER,
    created: '2026-09-01T09:00:00Z',
    updatedUser: TESTER,
    updated: '2026-09-09T09:00:00Z',
  };
}

/*
 * キーワードでは絞らずに返す。拡張はキーワード対象を API に伝えられず、
 * 取得後に自分で絞る（services/search/query.ts の rowFilter）ので、
 * 素通しで返すほうが「どちらが絞ったのか」が分かる。
 */
const ISSUES = [
  issue(
    123,
    '請求書の発行フローを見直す',
    '月末の請求書発行が手作業のままで、担当者に負荷が寄っている。',
  ),
  issue(142, '請求先マスタの登録画面を直す', '請求先の郵便番号が全角で入ると保存できない。'),
];

const API: Record<string, unknown> = {
  '/api/v2/rateLimit': RATE_LIMIT,
  '/api/v2/users/myself': { id: 1, userId: 'tester', name: 'テスト太郎' },
  '/api/v2/projects': [
    { id: 101, projectKey: 'PROJ', name: 'Webリニューアル', archived: false, useWiki: true },
    { id: 102, projectKey: 'MOB', name: 'モバイルアプリ v3', archived: false, useWiki: true },
  ],
  '/api/v2/issues': ISSUES,
  '/api/v2/wikis': [],
  '/api/v2/documents': [],
};

function handleOAuth(url: URL): { status: number; headers: Record<string, string> } | undefined {
  if (url.pathname !== '/OAuth2AccessRequest.action') return undefined;

  const redirect = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');
  if (redirect === null) return { status: 400, headers: {} };

  const target = new URL(redirect);
  // 認可されたことにして、拡張のリダイレクト URI へ code を返す
  target.searchParams.set('code', 'test-authorization-code');
  if (state !== null) target.searchParams.set('state', state);

  return { status: 302, headers: { location: target.toString() } };
}

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
    const url = new URL(req.url ?? '/', `https://${SPACE_HOST}`);

    const oauth = handleOAuth(url);
    if (oauth !== undefined) {
      res.writeHead(oauth.status, oauth.headers);
      res.end();
      return;
    }

    if (url.pathname === '/api/v2/oauth2/token') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      );
      return;
    }

    const api = API[url.pathname];
    if (api !== undefined) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(api));
      return;
    }

    if (url.pathname === '/EditApiSettings.action') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(API_SETTINGS_HTML);
      return;
    }

    const title = PAGES[url.pathname] ?? 'ダミー | Webリニューアル';
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
