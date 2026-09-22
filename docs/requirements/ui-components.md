# UI 部品と Storybook の仕様

`components/` に置く presenter の一覧、props の語彙、story のカタログ。**story が仕様**なので、
ここに書いた story 名がそのまま `name` になる。挙動の定義は [`palette.md`](palette.md) に置き、
ここでは「どの部品が何を受け取り、何を発火するか」と「どの story で何を固定するか」だけを書く。

前提: `components/` は拡張機能 API を import しない。Backlog のドメイン語（課題・Wiki・ステータス名）も
持ち込まない。ドメイン → 表示語彙の写像は `lib/` の責務。

---

## 1. 表示の語彙（props の型）

`components/types.ts` に 1 ファイルで置く。すべての部品はこの語彙だけで話す。

```ts
export type RowKind =
  | 'page' | 'issue' | 'wiki' | 'document' | 'project' | 'space'
  | 'command' | 'search' | 'panel' | 'connect' | 'status' | 'notice' | 'external' | 'hint';

export type Tone = 'neutral' | 'info' | 'success' | 'done' | 'warning' | 'danger';
export type Badge = { label: string; tone: Tone };

/**
 * 行が持つ動作。空なら Enter で何も起きず、ヒントも出ない（不変条件 I1）。
 * complete / stack は ⇥ の意味（補完か、スタックに積むか）。両方は持たない
 */
export type RowHint = 'enter' | 'modEnter' | 'descend' | 'complete' | 'stack';

export type RowView = {
  id: string;                    // セクション横断で一意。同じ対象が複数セクションに並ぶなら接頭辞で分ける（選択・↑↓ は id で引く）
  kind: RowKind;
  code?: string;                 // 等幅の短い識別子（PROJ-123）
  title: string;                 // 1 行省略 + title 属性
  sub?: string;                  // 補足。「·」区切りの平文。組み立ては呼び出し側
  marker?: Badge;                // 状態（ステータス相当）
  tag?: Badge;                   // 分類（課題種別相当）
  space?: { label: string; icon?: string };  // 出自バッジ。全スペースのときだけ渡る。label はスペース名、icon はアイコン画像の URL
  hints: readonly RowHint[];
  tone?: 'default' | 'accent' | 'danger';
  busy?: boolean;                // 検索中… のスピナー
};

export type SectionView = {
  id: string;
  label?: string;                // 無ければ見出しを描かない
  meta?: string;                 // 見出し右の補足（件数・進捗・「よく開く順」）
  rows: readonly RowView[];
};

export type PathSegmentView = {
  id: string;
  label: string;
  badge?: boolean;               // スペース・プロジェクトのバッジを添える
  icon?: string;                 // バッジに使うアイコン画像。無ければ頭文字
  armed?: boolean;               // 削除待ち。取り消し線 + 警告色
  compact?: boolean;             // ラベルを畳んでバッジだけにする
};

/** フッターのキーヒント。container が KeyBinding から導出して渡す（不変条件 I2） */
export type KeyHint = {
  id: 'enter' | 'modEnter' | 'move' | 'back' | 'take' | 'copyUrl' | 'toPanel';
  keys: readonly string[];       // 表示するキー記号（['⌘', '↵']）
  label: string;
  priority: number;              // 小さいほど残る。↵ は 0
};

export type ToastView = { message: string; detail?: string };

export type PaletteView = {
  path: readonly PathSegmentView[];
  input: { value: string; placeholder: string; completion?: string };
  armedNotice?: string;          // 「もう一度押すと {段} を外します」
  escLabel: string;              // 「閉じる」「1 つ前に戻る」
  sections: readonly SectionView[];
  selectedId?: string;           // 選択行。container が持つ（入力変更・検索起動で動かすため）
  footer: readonly KeyHint[];
  toast?: ToastView;
};
```

`KeyHint.id` はキーと 1:1 に対応する。story の共通検査（§5）はこの id からキー操作を再現する。

| id | 押すキー | 期待するコールバック |
|---|---|---|
| `enter` | `Enter` | `onAction(selectedId, { newTab: false })` |
| `modEnter` | `Meta+Enter` | `onAction(selectedId, { newTab: true })` |
| `move` | `ArrowDown` | `onSelectionChange(次の行 id)` |
| `back` | `Backspace`（キャレット先頭） | `onBackspaceAtStart()` |
| `take` | `Tab` | `onTake(selectedId)`（補完か積むかは選択行の `hints` で決まる。ラベルもそれに従う） |
| `copyUrl` | `Meta+Shift+C` | `onCopySearchUrl()` |
| `toPanel` | `Meta+ArrowRight` | `onOpenPanel()` |

### 1.1 サイドパネル用の語彙

```ts
export type FilterOption = { id: string; label: string; count?: number; tone?: Tone };
export type FilterField = {
  id: string; label: string; value: string;
  options: readonly FilterOption[];
  neutralValue?: string;         // 無条件を表す選択肢。value がこれと違えば「効いている」
};

/** 検索の単位（種別）ごとの進捗。スペース横断はしない（D-20）ので単位はスペースではない */
export type SearchProgress = {
  id: string; label: string;
  state: 'loading' | 'ready' | 'error';
  count?: number; message?: string;
  action?: { label: string };    // 「再接続」。押下は onProgressAction(id)
};

export type PanelView = {
  input: { value: string; placeholder: string };
  recentQueries: readonly string[];
  filters: readonly FilterField[];
  progress: readonly SearchProgress[];
  sections: readonly SectionView[];
  selectedId?: string;
  footer: readonly KeyHint[];
  toast?: ToastView;
};
```

パネルは本文のプレビューを持たない（D-1）。中身は Backlog のページで見る。

### 1.2 文言

部品の文言は `labels` として受け取り、`components/labels/ja.ts` と `en.ts` の辞書から渡す。既定は `ja`。
Storybook の toolbar に locale を持ち、両言語で見る。ドメイン語（ステータス名など）は辞書に入れず props で渡す。

---

## 2. 部品の一覧と層

```
components/
  types.ts                       表示の語彙（§1）
  tokens/palette.css             --bp-* トークン。light と dark
  atoms/
    Kbd.tsx                      キー記号の並び。dim で薄く
    Badge.tsx                    marker / tag 用。tone で色、dot で先頭に点
    SpaceBadge.tsx               出自バッジ。アイコン画像があれば画像、無ければ頭文字 1〜2 文字
    KindIcon.tsx                 RowKind → アイコン。写像はこのファイルだけが知る
    Spinner.tsx
    Button.tsx                   既存。tone に danger を足す
    Switch.tsx                   設定画面用
  molecules/
    ResultRow.tsx                行（§palette 5）。RowView + selected を受け取る。状態を持たない
    SectionHeader.tsx            見出し + 補足
    ScopePath.tsx                スコープパス。PathSegmentView[]
    PaletteInput.tsx             入力欄 + ゴースト補完 + プレースホルダ。ref を外へ出す
    KeyHints.tsx                 フッターのヒント列。priority で溢れを落とす
    Toast.tsx                    role="status" の 1 行
    SettingRow.tsx               設定画面の 1 行（ラベル・説明・コントロール）
  organisms/
    CandidateList.tsx            SectionView[] を role="listbox" で描く。仮想フォーカス、selectedId は controlled
    PaletteHeader.tsx            ScopePath + PaletteInput + esc ヒント（削除待ちの予告はこの位置に入れ替わる）
    PaletteFooter.tsx            KeyHints + Toast／銘
    Palette.tsx                  上 3 つを束ね、キー処理を 1 箇所に持つ。PaletteView とコールバックだけを受ける
    FilterBar.tsx                常設フィルターバー。単一選択のラジオとして描く。compact 形（surfaces §5.3）
    StatusStrip.tsx              種別単位の進捗・件数・エラー。リストの外に固定
    RecentQueries.tsx            入力欄が空のときの最近の検索
    SidePanel.tsx                入力 + RecentQueries + FilterBar + StatusStrip + CandidateList。PanelView を受ける
    ConnectSheet.tsx             API キーの貼り付けバー（surfaces §1）。画面下部中央の横長。入力欄とボタンだけ
    SpaceList.tsx                設定画面の接続スペース一覧
    CustomDomainForm.tsx         カスタムドメインの追加（surfaces §8）
  templates/
    PaletteFrame.tsx             ヘッダー／リスト／フッターの配置と高さの規則。データを持たない
    Overlay.tsx                  暗転 + 上寄せ中央配置。外側クリックを onDismiss で通知
    PanelLayout.tsx              サイドパネルの縦積み配置。幅 480px 未満で compact を伝える
    OptionsLayout.tsx            設定画面の 1 カラム配置
```

**依存の向き**: atoms → molecules → organisms → templates の順にしか import しない。`Palette` は `lib/` を知らない。

### 2.1 `Palette`（organism）のインターフェース

```ts
type PaletteProps = PaletteView & {
  onInputChange: (value: string) => void;
  onSelectionChange: (id: string) => void;
  onAction: (id: string, opts: { newTab: boolean }) => void;
  onTake: (id: string) => void;     // ⇥。補完か積むかは container が選択行の hints で判断する
  onBackspaceAtStart: () => void;
  onEscape: () => void;
  onCopySearchUrl?: () => void;
  onOpenPanel?: () => void;
  onDismiss?: () => void;          // 暗転クリック
  labels?: Partial<PaletteLabels>; // 既定は ja
  width?: number;                  // story 用。省略時はトークンの既定
};
```

`SidePanel` も同じ形（`PanelView` + コールバック）。フィルターの変更は `onFilterChange(fieldId, optionId)`、
ステータス帯の操作は `onProgressAction(id)`。行の動作・キー処理は `Palette` と同じ規則を共有する。

キー処理（§palette 6・13）は `Palette` の 1 箇所に置く。`isComposing` の捨て方、`Tab` の既定動作の抑止、
`Enter` の宛先を DOM から引き直す規則はここ。**molecules はキーを解釈しない。**

### 2.2 挙動レイヤーの実装方針（D-13）

MVP は react-aria-components の `Autocomplete` を土台にし、仮想フォーカスの持ち越し・`Escape` の消費・
`isComposing` の無視の 3 つを**キャプチャ段階で先回りして潰す**形になった（評価 §3）。
本実装では `CandidateList` を自前で書く（`role="listbox"` / `role="option"` / `aria-activedescendant`、
選択は controlled）。必要な挙動は 150 行程度で、外部ライブラリの内部状態と戦う箇所が無くなる。
Popover・Switch・RadioGroup のような**入力欄と競合しない部品**には Radix Primitives を使う（D-17）。

---

## 3. トークン

役割で名前を付ける。`--bp-marker-info` が青である必要はない。

```
--bp-surface-floating / -sunken / -overlay
--bp-row-selected / --bp-row-accent / --bp-row-danger
--bp-accent / --bp-accent-text
--bp-text-default / -subtle / -disabled / -inverse
--bp-border-default / -strong
--bp-marker-{neutral|info|success|done|warning|danger}-{bg|fg|dot}
--bp-font-body / --bp-font-mono
--bp-size-text-{xs|sm|md} / --bp-size-header / --bp-size-footer / --bp-size-row
--bp-radius-{inner|control|surface|pill}   入れ子は同心円: 内側 = 外側 − 余白。surface の中に space-2 で置くものは inner。pill の中は pill
--bp-space-{1..8}          4px 刻み
--bp-shadow-floating
--bp-width-palette         640px
```

- ライトを `:root` / `[data-color-scheme="light"]` に、ダークを `[data-color-scheme="dark"]` に。**同一要素セレクタと子孫セレクタを併記**する（MVP でダークが効かなかった罠）
- Storybook の toolbar に light / dark を持ち、全 story を両方で見る
- 見た目は Tailwind CSS v4 で書く（D-18）。`--bp-*` を `@theme inline` で Tailwind のテーマに写し、部品はテーマ経由のユーティリティか
  `h-(--bp-size-row)` のようなトークン参照だけを使う。幅の分岐は `--container-*` トークンを持つコンテナクエリ（`@max-narrow:` など）

---

## 4. フィクスチャ

`components/fixtures/` に日本語の現実的なダミーを置く。目的は**長さと記号の混在**を再現すること。

- プロジェクト名: `Webリニューアル` `モバイルアプリ v3` `社内ヘルプデスク`
- スペース: `nulab` `acme` `beta`（表示名は `ヌーラボ` `Acme Inc.` `ベータ開発`。バッジに出るのは表示名とアイコン）
- 課題キー: `PROJ-` `MOB-` `HELP-`
- 長い件名（40 文字以上）を最低 1 件: `受託案件 請求フロー標準手順（2024 改訂）に基づく請求書テンプレートの差し替え依頼`
- 人名: `田中 拓也` `佐藤 美咲` `山本 遼`
- `palette.md` の状態ごとに `PaletteView` を 1 つずつ用意する（S0〜S13、§5.4）
- `surfaces.md` §5 の状態ごとに `PanelView` を用意する（P1〜P5、§5.5）
- 英語の辞書で同じフィクスチャを描いたとき、レイアウトが崩れないことを見る（ラベル長が変わる）

---

## 5. story カタログ（＝仕様）

story の `name` は仕様を日本語で述べる。play function を持たない story は「描画で落ちない」のテスト。
`storybook/test` の `within` `userEvent` `expect` を使う。

### 5.1 共通の検査（全 `Palette` story に適用）

`components/organisms/Palette.invariants.ts` に共通の play を置き、状態 story から呼ぶ。

| 名前 | 検査 |
|---|---|
| フッターに出ているキーを押すと対応するハンドラが呼ばれる | `footer` の各 `KeyHint.id` について §1 の表どおりにキーを送り、コールバックが 1 回呼ばれる（I2） |
| ヒントを持つ行で Enter を押すと onAction が呼ばれる | `hints` が空でない各行を選択して `Enter`、`onAction(id)`（I1） |
| 動作を持たない行は ↑↓ で選択されない | `hints` が空の行を飛ばして選択が進み、選べる行の各々で `Enter` が `onAction` を呼ぶ（I1・D-35）。選択行は view ではなく DOM から引く |
| Tab を押してもフォーカスは入力欄から出ない | `Tab`／`Shift+Tab` 後に `document.activeElement` が入力欄のまま。選択行が `complete` か `stack` を持つときは `onTake` も呼ばれる（I3） |
| 変換中の Enter では onAction が呼ばれない | `isComposing: true` の keydown を送る（I5） |

### 5.2 atoms / molecules

| 部品 | story（name） |
|---|---|
| `Kbd` | 単キー／複数キー／dim |
| `Badge` | 6 つの tone が並ぶ／dot つき |
| `SpaceBadge` | 英字キー／日本語ラベルは頭文字 1 文字／アイコン画像があれば画像 |
| `KindIcon` | 全 RowKind が並ぶ（写像の抜けを描画で検出） |
| `ResultRow` | 課題（コード + マーカー + タグ + **先頭のスペースバッジ**、D-42）／ページ／プロジェクト（`⇥` のヒント）／コマンド `›`／検索行（アクセント）／未接続（危険色）／検索中（スピナー）／**長い件名は 1 行で省略され title 属性に全文を持つ**／**期限が近い課題は行に期限が出る**（D-50）／**選択行は左端の罫とタイトルの太字で示される**／**ヒントが空なら何も描かれない**／幅 360 |
| `SectionHeader` | 見出しだけ／補足つき |
| `ScopePath` | 根／1 段／2 段／コマンド階層／**削除待ちの段は取り消し線で示される**／**幅が足りないと左の段がバッジだけになる** |
| `PaletteInput` | 空でプレースホルダ／入力中／**ゴースト補完は入力の続きとして表示され選択できない**／変換中（下線つきの未確定文字） |
| `KeyHints` | 7 つ全部／**幅が足りないと priority の大きいものから落ち ↵ は必ず残る**／**落ちるのは優先順の右側だけで、ラベルの短い下位のヒントが上位を追い越して残らない**（D-40）／**キーを落とす前に短い言い方を試す**（D-44） |
| `Toast` | 文言だけ／詳細つき（URL） |

### 5.3 organisms

| 部品 | story（name） |
|---|---|
| `CandidateList` | 3 セクション／**↓ で選択が次の行へ移り末尾で止まる**／**↑ は先頭で止まる**／**セクション見出しは選択の対象にならない**／**クリックで onAction が呼ばれ、ホバーは強調されるが選択は動かない**／**selectedId が変わると aria-activedescendant が追従する** |
| `PaletteHeader` | 通常／削除待ちの予告つき／esc ラベルが「1 つ前に戻る」 |
| `PaletteFooter` | ヒントのみ／トーストつき（ヒントは消えない） |
| `ConnectSheet` | 入力待ち（画面下部中央の横長。入力欄にフォーカスがある間は縁を accent にしてリングを出す）／送信中／エラー／完了／**Enter で接続が送信される**／**変換中の Enter では送信されない**／**空のまま接続は押せない** |
| `FilterBar` | 条件なし／2 条件が効いている（強調）／compact／プロジェクトが「すべて」でステータスが組み込みだけ（スペースの項目に「全スペース」は無い、D-20）／**選択肢は 1 つだけ選べる**／**neutral に戻すと強調が消える**／**「条件をすべて外す」でスコープは変わらない** |
| `StatusStrip` | 全部 ready（1 行に畳む）／**全部 loading（スピナーと 1 語に畳む、D-49）**／読み込み中とエラーが混ざる／エラーと再接続ボタン／**再接続を押すと onProgressAction が呼ばれる** |
| `RecentQueries` | 5 件／0 件（描かない）／**クリックで onPick が呼ばれる** |
| `CustomDomainForm` | 空／入力中／追加済み一覧／**不正なホストでは追加できない** |
| `SpaceList` | 接続済み 3 件／要再接続を含む／0 件の案内／**削除は 1 回目で確認になり 2 回目で onDisconnect が呼ばれる** |

### 5.4 `Palette` の状態 story

各 story は `palette.md` の状態に対応し、§5.1 の共通検査を必ず含む。加えて状態固有の検査を持つ。

| # | 状態 | 固有の検査（name） |
|---|---|---|
| S0 | 未接続で何も出せない | 接続行が 1 つだけあり選択されている |
| S1 | 空状態（履歴あり） | 最近開いた → この課題 → ページ → 担当中 の順に並び先頭行が選択されている（D-46） |
| S1' | 空状態（履歴なし） | 案内行はページのセクションの下にあり、ヒントを持たず、選択もそこへは行かない（D-35・D-38） |
| S1'' | 空状態（担当課題が届く前） | 見出しと `◌ 読み込み中…` の行が先に出て、選択はそこへ行かない（D-38） |
| S1''' | 空状態（担当課題の取得に失敗） | 読み込み中のままにせず再接続の行になる（D-45・I6） |
| S2 | ページ名を入力中（`ぼーど`） | ゴースト補完が出て Tab で onTake が呼ばれる／フッターの ⇥ ラベルが「補完」 |
| S3 | 課題キーを入力中（`PROJ-12`） | 直接ジャンプ行が先頭で選択されアクセント面を持つ／⌘↵ で newTab: true |
| S4 | 自由テキスト（`ログイン`） | 検索行が先頭／強い一致がある入力では候補が先頭で検索行が 2 番目 |
| S5 | 検索中 | 検索行の直下に検索中の行があり選択されている／見出しの補足に進捗が出る |
| S6 | 検索結果あり | 見出しの補足に種別ごとの件数／保留通知行の Enter で onAction が呼ばれる |
| S7 | 検索 0 件 | 案内行 → 広げる提案（アクセント）→ 本体検索 の順 |
| S8 | スコープ削除待ち | 右端の段が取り消し線／予告が出る／フッターの ⌫ ラベルが変わる |
| S9 | コマンド階層（`[space]` からスペースを切り替え） | 引数の行だけが並ぶ／esc ラベルが「1 つ前に戻る」／Esc で onEscape |
| S10 | 根（スペースを外した後） | 検索行が無い／接続済みスペースは space 行、未接続は connect 行／共通ページのセクションが出る（D-20） |
| S11 | 認証切れ | 結果は無く再接続行だけ。パレット全体はエラー画面にならない（I6） |
| S12 | コピー直後 | フッター右端にトースト、ヒントは消えない |
| S13 | `#もば` でプロジェクト行を選択中 | フッターの ⇥ ラベルが「スコープに積む」／Tab で onTake、Enter で onAction |
| — | 狭い幅（360） | ↵ が残り、補足が隠れ、パスがバッジだけになる |
| — | ダーク | S1 と S6 をダークで（描画のみ） |
| — | English | S1 と S6 を英語の辞書で（描画のみ。ラベル長の違いでフッターが溢れないこと） |
| — | 開き直し | ref の `focus()` を呼ぶと、入力欄の外に出ていたフォーカスが入力欄へ戻る |

### 5.5 `SidePanel` の状態 story

§5.1 の共通検査（フッターのキー・行の Enter・Tab・IME）を同じく回す。

| # | 状態 | 固有の検査（name） |
|---|---|---|
| P1 | 初期（前回の語と最近の検索） | 入力欄が空で ↑ を押すと onInputChange に直前の語が渡る |
| P2 | 結果あり（幅 380、compact） | ⇥ は補完だけで積む行が無い／スペースの項目は単一選択で「全スペース」が無い |
| P3 | 種別単位の逐次到着 | ステータス帯に読み込み中とエラーが並び、結果の行は動かない |
| P4 | 0 件 | 条件を外す提案が先頭 → プロジェクトを外す → 本体検索 |
| P5 | フィルター変更直後 | onFilterChange が呼ばれ、結果は検索中の表示になる |
| P6 | 結果が出ている状態で語を打ち直す | Enter は選択行を開かず、打ち直した語で検索しなおす |
| P7 | 検索を渡された | ref の `focus()` を呼ぶと、入力欄の外にあったフォーカスが入力欄へ戻る |

---

## 6. Storybook で作る順番

1. `tokens/palette.css` と preview の decorator（テーマ切替・幅）。ここで Storybook が「見た目の調整が完結する場所」になる
2. atoms（`Kbd` `Badge` `SpaceBadge` `KindIcon` `Spinner`）。写像とトークン参照だけなので早い
3. `ResultRow` と `SectionHeader`。行が決まると以降の story が読める
4. `ScopePath` `PaletteInput` `KeyHints` `Toast`
5. `CandidateList`（キーによる選択移動、controlled）
6. `PaletteHeader` `PaletteFooter` `PaletteFrame` `Overlay`
7. `Palette` と S0〜S13 のフィクスチャ、共通の不変条件 play
8. `FilterBar` `StatusStrip` `RecentQueries` `PanelLayout` → `SidePanel` と P1〜P5
9. `ConnectSheet` `SettingRow` `SpaceList` `CustomDomainForm` `OptionsLayout`
10. 英語辞書と locale toolbar。全 story を両言語・両テーマで通す

5 が終わった時点で `lib/` のスタック・入力解釈・キーマップの実装に並行して入れる。7 の story が緑になったら
container（`entrypoints/palette/`）の配線を始める。順番と並行の詳細は [`milestones.md`](milestones.md)。
