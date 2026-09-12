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
| `pnpm compile` | 型検査 (`tsc --noEmit`) |

## import のルール

WXT の auto-import は無効化している (`wxt.config.ts` の `imports: false`)。
`browser` や `defineBackground` は `#imports` から明示的に import する。

```ts
import { browser, defineBackground } from '#imports';
```
