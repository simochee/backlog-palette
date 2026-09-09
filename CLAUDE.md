# Backlog Palette — 作業ルール

実装の正典は [`docs/implementation-plan.md`](docs/implementation-plan.md)。判断に迷ったら
同文書 §2.2「体験の原則」に戻る。原則と矛盾する案は、どの資料に書かれていても採らない。

## 品質ゲートは CI に置く。ローカルで二重化しない

CI がこのリポジトリの品質ゲート。**ローカルに同じ検査を重ねない。**

- pre-commit / pre-push フックを入れない（husky・lefthook・lint-staged を使わない）
- コミット前に全スイートを回して緑を確認する義務はない。壊れているかは CI が言う
- ローカルで検査を回すのは「今書いたコードの答え合わせ」のため。範囲を絞って使う
  - `pnpm --filter @backlog-palette/core test` — いま触ったパッケージだけ
  - `pnpm fix` — 保存時整形の代わり
- CI 側が回すのは `pnpm check` / `pnpm -r typecheck` / `pnpm -r test` / `pnpm -r build`。
  ルートの script はこの 4 つを CI から呼べる形に保つ

## 情報の置き場所

コードは How、テストは What、コミットログは Why、コードコメントは Why not。

- **コード**: 達成方法だけを表す。コメントで説明したくなったら命名か分割で直す
- **テスト**: 振る舞いの仕様。テスト名は仕様を日本語で書く
  （「課題キー完全一致は先頭に出る」。「filterIssues が false を返す」ではない）
- **コミットログ**: 本文に Why。差分が示す What は subject 行までに留める。1 コミット = 1 つの Why
- **コードコメント**: 自然な実装を採らなかった理由だけ。外部の癖、性能上の制約、
  一見冗長でも消せない理由。将来の読者が「単純化」して壊すのを止めるために書く

設計判断そのものは `docs/implementation-plan.md` の §3（裁定）と §19（却下した選択肢）に追記する。

## パッケージの境界

```
ui  ←── extension ──→ core
```

- `packages/core` — 純粋ロジック。React もブラウザ拡張 API も知らない
- `packages/ui` — 見た目。Backlog のドメイン語を知らず、Storybook 単体で動く
- `apps/extension` — 両者を配線する唯一の場所

境界は Biome の `noRestrictedImports` で機械的に守っている。破りたくなったら
それは設計の見直しであって、設定の見直しではない。

## デザインシステム

プロトタイプの UI モックは社内デザインシステムで作られていた。**その資産・
パッケージ名・トークン名をこのリポジトリに持ち込まない。** 本番の見た目は
`packages/ui/src/tokens/` を差し替えて後から合わせる（§8）。

## リポジトリの公開範囲

現在 private。`docs/reference/` には社内向けのプロダクト定義が入っているので、
public にする場合は事前に内容を確認する。

## 環境

`mise.toml` で Node と pnpm を供給し、`package.json` の `devEngines` で強制する。
pnpm の設定は `pnpm-workspace.yaml` 側（pnpm 11 で `package.json` の `pnpm`
フィールドは読まれない）。
