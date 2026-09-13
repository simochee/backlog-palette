# Backlog Palette

WXT + React + Storybook で作るブラウザ拡張。

## 要件

要件は `docs/requirements/` にある。実装に入る前に `README.md` → `principles.md` → `palette.md` の
順で読む。UI を書くときは `ui-components.md` の story カタログが仕様。
Backlog の API・URL・ドメインの事実は `docs/backlog-facts.md` の台帳を見る。**再調査しない。**
決めていないことは `docs/requirements/decisions.md` にあり、決めたらそこに理由を残す。

## 環境

`package.json` の `devEngines` で Node 24.x (LTS) / pnpm 12.4.1 に固定している。
どちらも `onFail: "download"` なので、手元のバージョンが違っても pnpm が指定バージョンを
取得して使う。バージョン管理ツールの設定ファイル (`.node-version` など) は置かない。

ただし切り替わるのは pnpm 経由で起動したプロセスだけ。`pnpm dev` ではなく直接 `node` を
叩いた場合やエディタの言語サーバはシェルの Node を使う。

pnpm 12 は postinstall をデフォルトで実行しない。ネイティブバイナリを展開する依存を
追加したときは `pnpm-workspace.yaml` の `allowBuilds` に明示する。

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` / `pnpm dev:firefox` | 拡張を開発実行 |
| `pnpm build` / `pnpm build:firefox` | 本番ビルド |
| `pnpm zip` / `pnpm zip:firefox` | ストア提出用 zip |
| `pnpm storybook` | Storybook 起動 (http://localhost:6006) |
| `pnpm build:storybook` | Storybook 静的ビルド |
| `pnpm test` | story をテストとして実行 |
| `pnpm test:watch` | 同上、監視モード |
| `pnpm test:e2e` | 拡張を読み込んだ Chromium で E2E を実行。先に `pnpm build` と `pnpm build:firefox` が要る |
| `pnpm lint` / `pnpm lint:fix` | oxlint。型検査を兼ねる |
| `pnpm format` | oxfmt で整形 |

## ローカルのクオリティゲート

CI で検証することをローカルで繰り返さない。CI は非同期に動くので、結果を待つ間
セッションを止める理由がない。書けたらコミットしてプッシュし、結果は後から確認する。

`.github/workflows/ci.yml` が実行する。ローカルでは実行しない:

- `pnpm lint:fix`
- `pnpm format`
- `pnpm build` / `pnpm build:firefox`
- `pnpm build:storybook`
- `pnpm test`
- `pnpm test:e2e`

ローカルで動かすのは、手元で見ないと分からないものだけ。`pnpm dev` と `pnpm storybook`
の開発サーバがこれにあたる。

チェックを増やしたくなったら CI に足す。コミット前フックやローカル専用の検証
スクリプトは作らない。同じ検証を二重に走らせても分かることは増えず、待ち時間だけが
増える。

CI は前段が落ちても後続を走らせ、1 回の実行で失敗箇所を出し切る。直してプッシュする
たびに次の失敗を知る、という往復を避けるため。

## Lint と整形

oxc に寄せている。lint と型検査が oxlint (`.oxlintrc.json`)、整形が oxfmt
(`.oxfmtrc.json`)。整形は oxfmt の LSP かエディタの保存時整形に任せ、まとめて直したい
ときだけ `pnpm format` を叩く。

### 自動修正は CI がコミットする

CI は lint と整形を検査ではなく修正として走らせ (`pnpm lint:fix` / `pnpm format`)、
出た差分をオープンな PR があるブランチにコミットする。機械が直せる指摘を人に
往復させないため。

`oxlint --fix` は直せなかった指摘だけを報告して非ゼロ終了するので、検査を別に
走らせる必要はない。一方 `oxfmt` は書き換えるだけで非ゼロ終了しないため、
整形の検証点は「コミットできる PR がないのに差分が出たら落とす」という形で
Commit fixes ステップが持っている。

**push したら次の作業の前に `git pull` する。** CI がコミットを積んでいるとブランチが
進んでいる。

自動修正のコミットは新しい CI 実行を起こさない。`GITHUB_TOKEN` による push は
ワークフローをトリガしない仕様で、加えてコミット件名に `[skip ci]` を付けている。
片方だけでも止まるが、required status checks のために GitHub App トークンへ
差し替えた瞬間に前者の前提が消えるため、二重にしてある。

修正後のコードは同じ実行の後続ステップが検証するので検証漏れはないが、
**チェック結果は修正前のコミットに紐づく**。PR の最新コミットにチェックが
付いていないように見えるのはこのため。ここを埋めたくなったら
`[skip ci]` を外した上でトークンを差し替えることになる。

### 型検査を oxlint に統合している

`tsc --noEmit` は使わない。`options.typeCheck` が TypeScript コンパイラの診断
(`TS2322` などのエラーコード) をそのまま出すため、同じ検査を 2 プロセスに分ける理由が
ない。tsconfig は共有しているので `strict` 系オプションも `#imports` の型も効く。

ただし**報告対象のファイル集合は一致しない**。tsc は tsconfig の `include`、oxlint は
ファイル走査から `.gitignore` を引いたもの。`web-ext.config.ts` のような gitignore 済みの
ローカル専用ファイルは oxlint の検査に載らない。

`typeCheck` は実験的機能である点も承知しておく。oxlint の型診断を疑うときは
`pnpm exec tsc --noEmit` が基準。script にしていないのは、常設すると CI で同じ検査を
二重に走らせることになるため。

### カテゴリの選び方

`correctness` / `suspicious` / `perf` / `pedantic` を error にしている。`style` と
`restriction` は採用しない。このプロジェクトの規約と正面から衝突するため
（`filename-case` は `Button.tsx` を kebab-case にしろと言い、`no-default-export` は
WXT の `defineBackground` と story の `meta` を否定する）。

個別ルールを切るときは、ルールごと `off` にする前にオプションで絞れないか見る。
無効化の理由は `.oxlintrc.json` にコメントとして残す。

## レイヤ構成

ディレクトリはすべてプロジェクトルート直下に並ぶ。`components/` はここ一つだけ。

```
components/    presenter。props だけを受け取る純粋な UI
  atoms/         それ以上分解できない UI 要素
  molecules/     atoms の組み合わせで一つの役割を持つ単位
  organisms/     molecules/atoms を束ねた意味のあるまとまり
  templates/     配置だけを決める。実データを持たない
lib/           拡張機能 API を扱う非 UI ロジック (storage, messaging, API client)
entrypoints/   WXT のエントリポイント。container として lib/ と components/ を配線する
  popup/
  background.ts
  content.ts
```

参照は `@/components/atoms/Button` の形で書く（`@` `~` `@@` `~~` はいずれも
プロジェクトルートを指す WXT のエイリアス。混在を避けるため `@` に統一する）。

### 依存の向き

```
entrypoints/ ──→ lib/          拡張機能 API はここ経由でのみ触る
     └───────→ components/     props を渡すだけ

components/ ──✗ lib/, 拡張機能 API
lib/        ──✗ React, components/
```

- `components/` は **拡張機能 API を一切 import しない**。`#imports`・`wxt/*`・`browser`・`chrome` は禁止。
  必要なデータと操作は props で受け取る。
- 下位層は上位層を知らない。atoms は molecules を import しない。
- `lib/` は React に依存しない。UI から切り離してテストできる状態を保つ。
- 状態を保持するのは `entrypoints/` の責務。

### 規約の強制

`.storybook/main.ts` の `rejectExtensionApi` プラグインが、`components/` からの
`#imports` / `wxt/*` を解決不能にしてビルドを落とす。

**型検査も lint もこの違反を検出しない。** WXT が生成する `#imports` の型宣言は
プロジェクト全体に効いているため、型としては解決できてしまう。`no-restricted-imports`
で禁止リストを書く手もあるが、モジュール解決を失敗させる方が抜け道がない。検出役は
`pnpm build:storybook` だけなので、CI からこれを外さないこと。

### Storybook

story を置くのは `components/` 配下だけ。`entrypoints/` には置かない
（container は拡張機能 API に依存しており、Storybook で再現する対象ではない）。

main への push で https://simochee.github.io/backlog-palette/ に公開される。
公開は CI の検証が通ったときだけ走るので、壊れた Storybook は世に出ない。

## import のルール

WXT の auto-import は無効化している (`wxt.config.ts` の `imports: false`)。
`browser` や `defineBackground` は `#imports` から明示的に import する。

```ts
import { browser, defineBackground } from '#imports';
```

## 情報の置き場所

How / What / Why / Why not をそれぞれの置き場所に分ける。読み手が「どこを見れば
いいか」を迷わないことが目的。

### コード — How

どうやって実現しているかを書く唯一の場所。命名・構造・型で意図を読ませる。
コメントで説明したくなったら、それは設計の綻びのサイン。コメントを書く前に
リネームや抽出でコードに語らせる。

### テスト — What

何をするコードなのかの仕様書として書く。テスト名は振る舞いを述べる
（「期限切れの課題は一覧から除外される」。「filterIssues が false を返す」ではない）。
実装を読まずに入力・出力・境界条件が分かる状態を目指す。
仕様が固まっていないうちはテストを書かない。書けないことが What の未定義を示している。

テストは story の play function として書く。`@storybook/addon-vitest` が story を
そのまま vitest のテストとして実行するため、確認したい振る舞いごとに story を足す。
play function を持たない story も、描画時に落ちないことのテストとして数えられる。

振る舞いを述べる story には `name` を付けて仕様を日本語で書く。エクスポート名は
識別子の制約に従い、読み手が見るのは `name` の方。

testing-library は `storybook/test` から import する (`within`, `userEvent`, `expect`)。
`@testing-library/dom` や `jest-dom` のマッチャはここに同梱されているので、
個別にインストールしない。

### コミットログ — Why

本文にはなぜその変更が必要だったかを書く。何を変えたかは diff が語るので、
件名以上には繰り返さない。背景（課題・障害・判断・検討した代替案）を残す。
課題キーがあるときは必ず含める。1 コミット 1 Why。複数あるなら分割を検討する。

### コードコメント — Why not

自明な実装を**選ばなかった**理由だけを書く。回避している外部の癖やバグ、
性能上の制約、退けた代替案とその理由、冗長に見えるが消してはいけないコード。
コードが自然で読めば分かるなら、コメントゼロが正解。コメントの量は丁寧さの指標ではない。

Why not コメントの目的は、将来の読み手が「単純化」してコードを壊すのを止めること。
その基準で必要性を判断する。

## プルリクエスト

squash merge で取り込む。PR のタイトルがそのまま squash 後のコミット件名に、本文が
コミット本文になるため、「コミットログ — Why」の規約がそのまま PR に適用される。

### タイトル

Conventional Commits に従い、説明部分は日本語で書く。型はコミット件名と同じものを使う
(`feat` / `fix` / `refactor` / `test` / `docs` / `ci` / `chore`)。

```
feat: presenter と container を分離した Atomic Design 構成を導入する
```

### 本文

見出しは英語、中身は日本語で書く。章立ては次で固定し、該当しない任意章は省く。

```markdown
## Why

解決する課題や背景。この変更がなかったら何が困るのかを書く。
課題キーがあるときはここに含める。

## Changes

- 構成コミットの Why を 1 行ずつ

## Alternatives

退けた選択肢と、退けた理由。

## Verification

検証済みのことと、未検証のまま残っていること。
レビュアーに見てほしい点や手元で動かす手順があればここに書く。
```

`## Why` と `## Changes` は必須。`## Alternatives` と `## Verification` は書くことが
あるときだけ置く。

`## Changes` に並べるのは変更内容の一覧ではなく、コミット単位の Why。squash すると
個々のコミットログが履歴から消えるため、ここが唯一の受け皿になる。何を変えたかは
diff が語るので列挙しない。

### 粒度

1 PR = 1 つの目的。squash 後のコミットが「1 コミット 1 Why」を満たすかで判断する。
満たさないなら PR を分ける。
