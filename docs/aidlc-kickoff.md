# AI-DLC 正式実装のキックオフ

このリポジトリの現状は **MVP**。`⌘K` を中心にした操作が成立するかを確かめるために、
デザインモックと機能アイデアから直接実装したもの。仮説は確かめられた
（[`docs/mvp-evaluation.md`](mvp-evaluation.md) §8.1）。

正式実装は AI-DLC Workflows v2 で、**クリーンな別セッション**でやる。この文書はその起点。

## 1. 前提を GitHub から読む

**ローカルの worktree やブランチの前後関係に依存しない。** 参照する文書はすべて
`gh api` で読める（private リポジトリだが `gh` の認証で通る）。

```sh
gh api repos/simochee/backlog-palette/contents/docs/<名前>.md \
  -H 'Accept: application/vnd.github.raw'
```

読む順に:

| 文書 | 何のために |
|---|---|
| `mvp-evaluation.md` | **これが主**。特に §3（踏んだ罠 15 件）・§6（過剰なもの）・§8（実機評価） |
| `backlog-facts.md` | 計測済みの事実。**再調査しない**。API の挙動・レート制限・OAuth の仕様 |
| `implementation-plan.md` | 設計の正典。ただし §3 D4・D5 は §8.3 で覆っている |

## 2. MVP の在処

| | |
|---|---|
| リポジトリ | `simochee/backlog-palette`（private） |
| ブランチ | `main` = `mvp`。どちらも MVP の最終状態を指す |

`mvp` は「ここまでが MVP」を示す目印として固定する。正式実装はここから分岐する。

## 3. 起動手順

```sh
# 1. 新しく clone する（既存のローカル作業ツリーとは関係を持たせない）
ghq get git@github.com:simochee/backlog-palette.git
cd "$(ghq root)/github.com/simochee/backlog-palette"
git switch -c aidlc origin/mvp

# 2. 環境を用意する
mise install && pnpm install

# 3. AI-DLC を入れる
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
aidlc config --harness claude
```

scope は **`mvp`**。`feature` は単機能に閉じすぎ、`poc` は既に作り終えている。

既存コードがあるので `reverse-engineering` を通す:

```
ideation → reverse-engineering → requirements-analysis → user-stories → units-generation
```

## 4. Inception で口頭で足すこと

§1 の文書を読めば足りるものは繰り返さない。**読んでも出てこないもの**だけを渡す。

**(a) 検索結果はパレットに出る。** サイドパネルは詳細を見る面。
実装プランの「モーダル＝行く／サイドパネル＝探す」という分離は実機で否定された（§8.3）。
**reverse-engineering が既存コードから読み取る構造をそのまま信じない。**

**(b) 「表示されている行と、フッターが出しているキーには、必ず対応する動作がある」を不変条件にする。**
MVP で 3 箇所破れた（§8.2）。個別のテストではなく機械的な検査で守りたい。

**(c) テストは「押した結果」を問う。** `toBeFocused` は 0×0 の iframe でも通る。
`textContent` は不可視の要素でも通る。「行が出ている」は押して何も起きなくても通る（§3.1）。
MVP の 585 件は数の割に捕まえられていない。

**(d) MVP から捨てるもの。** 585 件のテストをそのまま持ち込まない。`TypeTabs` は未使用。
`implementation-plan.md` は設計だけで要件が無い（これが §8.4 の原因）。

**(e) 秘密情報。** OAuth の client secret はチャットを通っているので、配布前にローテーションする。
値は `apps/extension/.env`（未コミット）にあり、キーの一覧は `.env.example` にある。
既定の接続方法は API キーで、OAuth は副で良い（実装プラン §10.0）。

## 5. 何を捨てないか

`packages/core` の純粋ロジック（スタック・照合・ランキング）は、要件が変わっても形が残る見込みが高い。
reverse-engineering に食わせる価値がある。捨てる判断は units-generation の後で良い。
