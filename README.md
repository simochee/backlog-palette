# Backlog Palette

`⌘K` で Backlog のどこへでも。課題キーやページ名を打つだけで移動でき、サイドパネルで課題・Wiki・ドキュメントをスペース横断で検索できるブラウザ拡張。

> **これは MVP です。** デザインモックと機能アイデアから 1 日で作った評価用のビルドで、要件定義と受け入れ条件を持ちません。何ができて何が無いかは [`docs/mvp-evaluation.md`](docs/mvp-evaluation.md) にまとめてあります。

## 入れ方

1. `backlog-palette-0.1.0-chrome.zip` を展開する
2. Chrome で `chrome://extensions` を開き、右上の **デベロッパーモード** を ON
3. **パッケージ化されていない拡張機能を読み込む** で、展開したフォルダを選ぶ

Backlog のページを開いて `⌘K`（Windows は `Ctrl+K`）を押すと出ます。

## できること

| 操作 | 動き |
|---|---|
| `⌘K` → ページ名 | ボード・ガント・Wiki などへ移動。かな入力でも英字でも引ける |
| `⌘K` → `PROJ-123` | その課題へ直接ジャンプ |
| `⌘K` → プロジェクト名 | プロジェクトを切り替え |
| `⌘K` → `こぴー`（課題ページで） | 課題キー / 課題キー+件名 / Markdown リンク / URL をコピー |
| `⌘K` で何も打たない | 最近開いた項目、現在プロジェクトのページ、担当中の課題 |
| `⌫`（キャレットが先頭） | スコープを 1 段外す。2 回押しで外れる |
| ツールバーのアイコン | 検索パネルを開く |
| パネルで語を打って `Enter` | 課題・Wiki・ドキュメントをスペース横断で検索 |
| パネルで `⌘⇧C` | 検索条件を URL にしてコピー |

## 接続

Backlog のページで `⌘K` → 「このスペースを接続」を選ぶと、API キーの発行ページへ移動します。メモ欄は入力済みなので、発行して表示されたキーをコピーし、右下に出る貼り付け欄に貼ってください。

キーは端末内にのみ保存され、外部へは送信されません。拡張の設定画面からいつでも削除できます。

## 無いもの

評価の焦点を絞るため、意図的に外しています。詳細と理由は [`docs/mvp-evaluation.md`](docs/mvp-evaluation.md)。

英語表示 / 利用状況の計測 / Firefox 対応 / ブラウザ履歴からの取り込み / 属性語による絞り込み（「処理中 決済」のような入力）/ モーダルから検索パネルへの昇格

## 開発

```
mise install          # Node と pnpm を用意する
pnpm install
pnpm dev              # Chrome を起動して拡張を読み込む
pnpm test             # ユニットテスト
pnpm test:e2e         # 偽の Backlog スペースを立てて通しで検証
pnpm --filter @backlog-palette/ui dev   # Storybook で UI だけを見る
```

接続まで試すには `apps/extension/.env` が要ります。`apps/extension/.env.example` を参照してください。

実装の背景と設計判断は [`docs/implementation-plan.md`](docs/implementation-plan.md)、Backlog の API とページ URL の実測は [`docs/backlog-facts.md`](docs/backlog-facts.md) にあります。
