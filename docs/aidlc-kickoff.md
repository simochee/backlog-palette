# AI-DLC 正式実装のキックオフ

このリポジトリの現状は **MVP**。`⌘K` を中心にした操作が成立するかを確かめるために、
デザインモックと機能アイデアから直接実装したもの。仮説は確かめられた（`mvp-evaluation.md` §8.1）。

正式実装は AI-DLC Workflows v2 で、**別セッション**でやる。この文書はその起点。

## 1. MVP はどこにあるか

`mvp` ブランチ。作業ツリーは `Design`。**評価の結論は `docs/mvp-evaluation.md` §8 にある。**

正式実装のセッションは `mvp` を起点に新しいブランチを切る。MVP のコードを消すのではなく、
**要件とユーザーストーリーを先に作り直してから、通るものだけを残す**。

## 2. 起動手順

```sh
# 1. worktree を作る（git worktree は Orca のフックで止まる）
orca worktree create --name aidlc --parent-worktree active

# 2. その worktree で mvp を起点にブランチを切る
git switch -c aidlc mvp

# 3. AI-DLC を入れる
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh
aidlc config --harness claude
```

scope は **`mvp`**。`feature` は単機能に閉じすぎ、`poc` は既に作り終えている。

流れは Inception から。既存コードがあるので `reverse-engineering` を通す:

```
ideation → reverse-engineering → requirements-analysis → user-stories → units-generation
```

## 3. Inception で伝えること

MVP で分かったことのうち、**設計文書からは出てこなかったもの**だけを渡す。
残りは既存文書を読ませれば足りる。

### 3.1 読ませる文書

| 文書 | 何のために |
|---|---|
| `docs/mvp-evaluation.md` | **これが主**。特に §3（踏んだ罠 15 件）・§6（過剰なもの）・§8（実機評価） |
| `docs/backlog-facts.md` | 計測済みの事実。**再調査させない**。API の挙動・レート制限・OAuth の仕様 |
| `docs/implementation-plan.md` §3・§19 | 裁定と却下した選択肢。**§3 D4 と D5 は §8.3 で覆っている** |

### 3.2 口頭で足すこと

**(a) 検索結果はパレットに出る。** サイドパネルは詳細を見る面。
実装プランの「モーダル＝行く／サイドパネル＝探す」という分離は実機で否定された（§8.3）。
これは要件の前提が変わる話なので、reverse-engineering の結果をそのまま信じさせない。

**(b) 「表示されている行と、フッターが出しているキーには、必ず対応する動作がある」を不変条件にする。**
MVP で 3 箇所破れた（§8.2）。個別のテストではなく機械的な検査で守りたい。

**(c) テストは「押した結果」を問う。** `toBeFocused` は 0×0 の iframe でも通る。
`textContent` は不可視の要素でも通る。「行が出ている」は押して何も起きなくても通る（§3.1）。
MVP の 585 件は数の割に捕まえられていない。

**(d) MVP から捨てるもの**: 585 件のテストをそのまま持ち込まない。`TypeTabs` は未使用。
`docs/implementation-plan.md` は設計だけで要件が無い（これが §8.4 の原因）。

**(e) OAuth の client secret はチャットを通った。** 配布前にローテーションする。
既定の接続方法は API キーで、OAuth は副で良い（§10.0）。

## 4. 何を捨てないか

`packages/core` の純粋ロジック（スタック・照合・ランキング）は、要件が変わっても形が残る見込みが高い。
reverse-engineering に食わせる価値がある。捨てる判断は units-generation の後で良い。
