# OAuth アプリの登録内容

Backlog の OAuth アプリ登録画面に入れる値。発行後の client_id / client_secret は
**このファイルに書かない**（`apps/extension/.env` に置く。`.env` は gitignore 済み）。

## Redirect URI

```
https://pgecmjiliokjhapnleojocbdneldfppo.chromiumapp.org/
```

- 末尾のスラッシュを含めてこの形。`browser.identity.getRedirectURL()` がパス無しで返す値と一致させる
- 拡張 ID は `apps/extension/wxt.config.ts` の manifest `key`（公開鍵）で固定している。読み込む場所やプロファイルが変わっても変わらない
- **Chrome ウェブストアに提出すると ID はストア側の値になる**ので、そのときに登録し直す
- Firefox は `getRedirectURL()` が別形式を返すため、Firefox 対応（M6）で追加登録が要る

## 言語

**日本語を既定の表示にする**。主な利用者が日本語話者で、認可画面は利用者の言語で出る（実装プラン §2.1）。
English も追加しておく。

## アプリケーション名（64 文字以内）

| 言語 | 値 |
|---|---|
| 日本語 | `Backlog Palette` |
| English | `Backlog Palette` |

ブランド名は言語で変えない（仕様書 §10.1 で確定）。ストア表示名のサブタイトル
「Cmd+K で移動と検索」は認可画面には要らない。名前が長いと
「〜がアクセスを求めています」の文が読みにくくなる。

**開発用に登録するなら `Backlog Palette (開発)` にする。** 将来の公式アプリと
認可画面で区別が付かないと、利用者がどちらを許可したのか分からなくなる。

## アプリケーションの説明（1000 文字以内）

認可画面に出る文なので、宣伝文ではなく**何にアクセスし、それをどう扱うか**を書く。

### 日本語

```
Backlog Palette は、キーボードだけで Backlog を移動・検索するためのブラウザ拡張機能です。

Cmd+K（Windows では Ctrl+K）を押して、課題キー（PROJ-123）やページ名を打つだけで目的の場所へ移動できます。サイドパネルでは、課題・Wiki・ドキュメントを複数のスペースをまたいで検索できます。

このアプリケーションは、あなたがすでにアクセスできるプロジェクト・課題・Wiki・ドキュメントの読み取りに Backlog API を使用します。読み取った内容は候補と検索結果の表示のためにブラウザ内でのみ利用し、外部のサーバーへは送信しません。閲覧履歴と学習データもブラウザ内にのみ保存され、設定からいつでも削除できます。
```

### English

```
Backlog Palette is a browser extension for navigating and searching Backlog entirely from your keyboard.

Press Cmd+K (Ctrl+K on Windows) and type an issue key such as PROJ-123, or a page name, to jump straight there. The side panel searches issues, wikis and documents across all of your spaces.

This application uses the Backlog API to read the projects, issues, wikis and documents you already have access to. What it reads is used only to render suggestions and search results inside your browser; nothing is sent to any external server. Your browsing history and learning data stay in your browser and can be cleared at any time from the settings page.
```

## サイト URL

```
https://github.com/simochee/backlog-palette
```

リポジトリは現在 private なので、認可画面からこのリンクを開いた人には 404 が出る。
自分以外に配る前に public にするか、別の説明ページを用意する。

## アプリアイコン

まだ無い。アイコンの生成（`@wxt-dev/auto-icons`）は M6 なので、今は未設定でよい。
認可画面での見え方に効くので、配る前には設定する。

## 発行後にやること

1. client_id と client_secret を `apps/extension/.env` に置く

   ```
   BP_OAUTH_CLIENT_ID=...
   BP_OAUTH_CLIENT_SECRET=...
   ```

2. **別のスペースでも同じ client_id で認可できるかを確かめる**（未決 #24）。
   認可エンドポイントはスペースごとのホスト（`https://{space}.backlog.com/OAuth2AccessRequest.action`）
   なので、あるスペースで登録したアプリが他のスペースでも使えるとは限らない。
   使えない場合、この拡張の中心にあるスペース横断は OAuth では成立せず、
   2 つ目以降のスペースは API キー接続に頼ることになる。
