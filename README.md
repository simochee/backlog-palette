# Backlog Palette

WXT + React + Storybook で作るブラウザ拡張。

## セットアップ

Node.js 24.x (LTS) と pnpm 12.4.1 を使う。どちらも `package.json` の `devEngines` に
書いてあり、手元のバージョンが違っても pnpm が自動で取得する。バージョン管理ツールの
設定は不要。

```sh
pnpm install
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | Chrome で拡張を開発実行 |
| `pnpm dev:firefox` | Firefox で拡張を開発実行 |
| `pnpm build` / `pnpm build:firefox` | 本番ビルド |
| `pnpm zip` / `pnpm zip:firefox` | ストア提出用 zip |
| `pnpm storybook` | Storybook を http://localhost:6006 で起動 |
| `pnpm build:storybook` | Storybook を静的ビルド |
| `pnpm test` | story をテストとして実行 |
| `pnpm compile` | 型検査 (`tsc --noEmit`) |

型検査・ビルド・テストは push のたびに CI が実行するので、手元で繰り返す必要はない。

Storybook は main への push で https://simochee.github.io/backlog-palette/ に公開される。

## 構成

```
components/    presenter。props だけを受け取る純粋な UI (atoms / molecules / organisms / templates)
lib/           拡張機能 API を扱う非 UI ロジック
entrypoints/   WXT のエントリポイント。lib/ と components/ を配線する container
```

`components/` は拡張機能 API に触れない。`browser` を使う処理は `lib/` に置き、
`entrypoints/` が props として渡す。この規約は Storybook のビルドが検証する
（違反すると `pnpm build:storybook` が失敗する）。

詳しい規約は [CLAUDE.md](./CLAUDE.md) を参照。

## import のルール

WXT の auto-import は無効化している (`wxt.config.ts` の `imports: false`)。
`browser` や `defineBackground` は `#imports` から明示的に import する。

```ts
import { browser, defineBackground } from '#imports';
```
