# Backlog Palette — production 要件

`mvp` ブランチで確かめた仮説（「覚えるキーは `⌘K` ひとつでよい」）を、配れる品質で作り直すための要件。
MVP の評価（`mvp:docs/mvp-evaluation.md` §8.4）が指摘した穴、**「操作と結果の対応がどこにも書かれていない」**を
埋めるのがこの文書群の目的。機能の一覧ではなく、**行を押したら何が起きるか・キーは何をするか**を通しで定める。

最初の実装は Storybook 上の UI から始める。そのため [`ui-components.md`](ui-components.md) と
[`palette.md`](palette.md) を先に読めば UI の実装に着手できる構成にしている。

## 文書の一覧

| 文書 | 内容 | 読む人 |
|---|---|---|
| [`principles.md`](principles.md) | 体験の原則と不変条件。判断に迷ったらここへ戻る | 全員 |
| [`palette.md`](palette.md) | パレットの通し仕様。状態・行・キー・非同期の規則 | UI・container を書く人 |
| [`ui-components.md`](ui-components.md) | Storybook で作る部品、props の語彙、story カタログ（＝仕様） | UI を書く人 |
| [`surfaces.md`](surfaces.md) | パレット以外の面（サイドパネル・接続シート・設定画面・Backlog 外での挙動・Firefox・カスタムドメイン・言語・計測） | container を書く人 |
| [`decisions.md`](decisions.md) | 決定事項 D-1〜D-20 と記録。§0 に判断の前提（工数で縮小しない） | 判断する人 |
| [`milestones.md`](milestones.md) | マイルストーン。依存と検証ゲートで組み、人が要る工程を明示 | 進め方を決める人 |
| [`tech-stack.md`](tech-stack.md) | 技術スタック（TanStack を軸に層ごとの割り当て）、実行コンテキストの責務、データの流れ | 実装する人 |
| [`../backlog-facts.md`](../backlog-facts.md) | Backlog の API・URL・ドメインの実測台帳（`mvp` から継承） | 全員。**再調査しない** |

## MVP から何を引き継ぐか

| 分類 | 扱い | 理由 |
|---|---|---|
| 実測の事実（`backlog-facts.md`） | **そのまま信じる** | 再現に時間がかかる。確度が行ごとに記録されている |
| 設計上の裁定（`mvp:docs/implementation-plan.md` §3 D1〜D3・D6・D7） | 引き継ぐ | スタックモデル、Tab＝補完、フラット表示、React + 挙動レイヤー。実機で崩れなかった |
| 裁定 D4・D5（モーダル＝行く／サイドパネル＝探す） | **役割を変えて引き継ぐ**。全スペース検索の裁定は D-20 で退いた | 検索結果はパレットに出る（評価 §8.3）。パレットは語とスコープだけ、サイドパネルは条件つきの詳細検索。フィルターバーはパネルに残る（[`decisions.md`](decisions.md) D-1・D-9） |
| 踏んだ罠（評価 §3） | 実装時に必ず読む | 作り直しても再現する制約。ここには転記しない |
| UI 実装（`mvp:packages/ui`） | **参考程度** | 情報設計は引き継ぐが、Atomic Design の層に組み直す。`TypeTabs` など未使用部品は持ち込まない |
| テスト 585 件 | 持ち込まない | 基準なしに増えた。story を仕様として書き直す |
| `implementation-plan.md` の計画部分（§17 の Phase 分け） | **使わない** | 1 名の人手を前提に工数で切っている。開発は Claude Code で進めるので、範囲は製品上・技術上の理由だけで決める（`decisions.md` §0） |

## 凡例

- **決定**: この文書群で確定している。変えるときは `decisions.md` に理由を残す
- **D-n**: `decisions.md` §1 で決めた事項。覆すときは記録を残す
- **Phase 2**: 作らない。思いついても入れない。`decisions.md` 末尾に積む

## Phase 1 の範囲（一文で）

Backlog のページで `⌘K` を押すと出るパレットで、**ページ移動・課題キーのジャンプ・プロジェクトとスペースの切替・
コピー・スペース内のキーワード検索**（D-20。スペース横断はしない）がキーボードだけで完結し、条件を付けて探すときはサイドパネル（詳細検索）へ渡せる。
接続・設定・日英表示・Firefox・計測がそれを支える。
Phase 2 に残すのは**書き込み操作**と、製品として未定義のもの（`decisions.md` §4）だけ。
