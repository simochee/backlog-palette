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
| [`surfaces.md`](surfaces.md) | パレット以外の面（接続シート・設定画面・content script の見え方） | container を書く人 |
| [`decisions.md`](decisions.md) | 要決定事項と推奨案。**着手前に埋める** | 判断する人 |
| [`../backlog-facts.md`](../backlog-facts.md) | Backlog の API・URL・ドメインの実測台帳（`mvp` から継承） | 全員。**再調査しない** |

## MVP から何を引き継ぐか

| 分類 | 扱い | 理由 |
|---|---|---|
| 実測の事実（`backlog-facts.md`） | **そのまま信じる** | 再現に時間がかかる。確度が行ごとに記録されている |
| 設計上の裁定（`mvp:docs/implementation-plan.md` §3 D1〜D3・D6・D7） | 引き継ぐ | スタックモデル、Tab＝補完、フラット表示、React + 挙動レイヤー。実機で崩れなかった |
| 裁定 D4・D5（モーダル／サイドパネルの役割分離） | **覆す** | 検索結果はパレットに出る（評価 §8.3）。サイドパネルは Phase 1 から外す（[`decisions.md`](decisions.md) D-1） |
| 踏んだ罠（評価 §3） | 実装時に必ず読む | 作り直しても再現する制約。ここには転記しない |
| UI 実装（`mvp:packages/ui`） | **参考程度** | 情報設計は引き継ぐが、Atomic Design の層に組み直す。`TypeTabs` など未使用部品は持ち込まない |
| テスト 585 件 | 持ち込まない | 基準なしに増えた。story を仕様として書き直す |
| `implementation-plan.md` の計画部分 | 参照のみ | 要件を持たない設計文書。この文書群がその上に立つ |

## 凡例

- **決定**: この文書群で確定している。変えるときは `decisions.md` に理由を残す
- **推奨**: 決めてよいが、別の選択を選べる。`decisions.md` に番号つきで並ぶ
- **Phase 2**: 作らない。思いついても入れない。`decisions.md` 末尾に積む

## Phase 1 の範囲（一文で）

Backlog のページで `⌘K` を押すと出るパレット 1 面で、**ページ移動・課題キーのジャンプ・プロジェクトとスペースの
切替・コピー・スペース横断のキーワード検索**がキーボードだけで完結し、接続と設定がそれを支える。
