> **出自**: `mvp` ブランチの `docs/backlog-facts.md` をそのまま持ち込んだもの（2026-09-13）。
> 事実の台帳なので内容は変えていない。追記するときは根拠の区分（§0）を付ける。
> 台帳内の「実装プラン §n」は `mvp` ブランチの `docs/implementation-plan.md` を指す。

# Backlog 事実台帳（ページ URL / 課題キー / API / ドメイン）

**この文書は事実の台帳であり、確認できていないものは「未確認」と明記する。**
推測を事実として書かない。曖昧なものは未確認として残し、§5 に「実測で確認すべき項目」としてまとめる。
`docs/implementation-plan.md` の実装（Phase 1 のページ移動、§7.1 入力の解釈、§7.4 検索オーケストレーション、§6.1 の信頼境界、§18 未決事項 #1 #5 #12）が参照する事実をここに集める。

社内機密（本体リポジトリの構成やコード上の場所）は書かない。公開されている製品仕様・公開 API・Nulab 公開 OSS・実測の範囲に留める。

## 0. 凡例（根拠の区分と確度）

| 記号 | 意味 | 出典 |
|---|---|---|
| ◎ | 公式ドキュメントに明記 | `developer.nulab.com/docs/backlog/`（Backlog Developer API）、`backlog.com/ja/enterprise-help/`（公開ユーザーガイド） |
| ○ | Nulab 公式の公開 OSS が実際に組み立てている / 実際に照合しているパス。仕様文書としての保証はない | `github.com/nulab/bee`（公式 CLI, `packages/backlog-utils/src/url.ts`）、`github.com/nulab/backlog-power-ups`（公式ブラウザ拡張, `plugins/*.ts` の `matches`、`entrypoints/register-plugins.content/index.ts`）、`github.com/nulab/backlog4j`（公式 Java クライアント, `BacklogUrlSupport` の URL 例コメント） |
| ● | 実測（2026-09-10、HTTP リクエストで確認） | 本調査 |
| ▲ | 検索スニペット・第三者記事のみ。原文を取得できていない | 該当箇所に明記 |
| ✗ | **未確認** | — |
| S | 社内 `backlog-product` スキル（製品事実知識） | 用語・ドメイン仕様のみ引用。実装場所には触れない |

> 注: `support-ja.backlog.com`（ヘルプセンター）は本調査の環境から 403 で取得できなかった。ヘルプセンターにしか載っていない事項は ▲ または ✗ になっている。

---

## 1. ページ URL の一覧

基準: `https://{space}.backlog.jp` / `https://{space}.backlog.com` / `https://{space}.backlogtool.com`（§4）。
以下は **パス部分のみ**を示す。`{projectKey}` はプロジェクトキー、`{issueKey}` は課題キー（`PROJ-123`）。

### 1.1 スペース系

| 画面 | パス | 確度 | 根拠 |
|---|---|---|---|
| ダッシュボード | `/dashboard` | ○ | bee `dashboardUrl()` が `/dashboard` を組み立てる／power-ups `absoluteDate` の `matches` に `"/dashboard"` |
| お知らせ | ✗ 未確認 | ✗ | 公開資料・公式 OSS のいずれにも該当パスの記述が見つからなかった |
| 担当している課題（自分の課題） | ✗ 未確認（専用ページの有無を含めて未確認） | ✗ | ダッシュボードに「マイ課題」が載ることは分かっている（S）が、独立ページの URL は不明 |
| ユーザープロフィール | `/user/{userId}` | ○ | power-ups `userSwitcher` が `url.pathname = /user/${user.id}` に書き換える。`matches: ["/user/*"]` |
| 個人設定 | ✗ 未確認 | ✗ | — |
| スペース設定 | ✗ 未確認 | ✗ | — |
| スペース横断の課題検索（本体の全体検索） | `/FindIssueAllOver.action` | ○ | power-ups `projectIssueFilter` / `totalTime` / `hideEmptyColumn` の `matches` |
| 課題（個別） | `/view/{issueKey}` | ○ | bee `issueUrl()`／backlog4j `getIssueUrl` のコメント `https://spacexxx.backlog.jp/view/TEST_PROJECT-123`／power-ups `matches: ["/view/**"]` |
| 課題のコメントアンカー | `/view/{issueKey}#comment-{commentId}` | ○ | backlog4j `getIssueCommentUrl` のコメント例 |

### 1.2 プロジェクト系

| 画面 | パス | 確度 | 根拠 |
|---|---|---|---|
| プロジェクトホーム | `/projects/{projectKey}` | ○ | bee `projectUrl()`／power-ups `matches: ["/projects/**"]` |
| 課題一覧 | `/find/{projectKey}` | ○ | bee `/find/${projectKey}`／power-ups `matches: ["/find/*", "/find/**"]` |
| 課題一覧のクエリ文字列（`?projectId=` 等） | ✗ 未確認（パラメータ名・必須性・保存済みフィルタの表現） | ▲ | 第三者記事に `/find/{...}?projectId=...` の例があるだけ。原典未確認 |
| 課題の追加 | `/add/…`（第 1 セグメントは `/add/`。第 2 セグメントの内容は未確認） | ○/✗ | power-ups `extendDesc` の `matches: ["/add/*"]` までが確認範囲。`{projectKey}` が入るかは未確認 |
| ボード | `/board/{projectKey}` | ○ | bee `/board/${projectKey}`／power-ups `boardOneline` の `matches: ["/board/*"]` |
| ガントチャート | `/gantt/{projectKey}` | ○ | bee `/gantt/${projectKey}`／power-ups `matches: ["/gantt/*", "/gantt/**"]` |
| Wiki トップ | `/wiki/{projectKey}` | ○ | bee `/wiki/${projectKey}` |
| Wiki 個別ページ（名前指定） | `/wiki/{projectKey}/{pageName}` | ○ | backlog4j `getWikiUrl` のコメント例 `https://spacexxx.backlog.jp/wiki/TEST_PROJECT/Home` |
| Wiki 個別ページ（ID 指定） | `/alias/wiki/{wikiId}` | ○ | bee `wikiUrl()`／power-ups `matches: ["/alias/wiki/*"]` |
| 上記が名前指定 URL へリダイレクトするか | ✗ 未確認 | ✗ | 実機で `/alias/wiki/{id}` を開き、最終的な `location.pathname` を見る。表示キャッシュに同じ Wiki が 2 行並ぶ頻度が変わる（decisions.md D-52） |
| ドキュメント トップ | `/document/{projectKey}` | ○ | bee `/document/${projectKey}` |
| ドキュメント 個別 | `/document/{projectKey}/{documentId}` | ○ | bee `documentUrl()`／power-ups `matches: ["/document/**"]` |
| ファイル（共有ファイル） | `/file/{projectKey}` | ○ | bee `/file/${projectKey}` |
| Git（プロジェクトのリポジトリ一覧） | `/git/{projectKey}` | ○ | bee `/git/${projectKey}` |
| Git リポジトリ | `/git/{projectKey}/{repoName}` | ○ | bee `repositoryUrl()` |
| Git プルリクエスト | `/git/{projectKey}/{repoName}/pullRequests/{number}` | ○ | bee `pullRequestUrl()`／backlog4j のコメント例／power-ups `matches: ["/git/*/*/pullRequests/**"]` |
| Git ファイル / ツリー / コミット | `/git/{projectKey}/{repoName}/blob/{branch}/{path}`、`…/tree/{branch}/{path}`、`…/commit/{sha}` | ○ | bee `gitBlobUrl()` / `gitTreeUrl()` / `gitCommitUrl()` |
| SVN | `/subversion/{projectKey}`、リビジョンは `/rev/…` | ○ | bee `/subversion/${projectKey}`／power-ups `matches: ["/subversion/**", "/rev/**"]` |
| プロジェクト設定 | `/EditProject.action?project.key={projectKey}`（`project.id={id}` 形式も公式 OSS 内に存在） | ○ | bee のテストが `"/EditProject.action?project.key=PROJ"`、実装側は `project.id=` を渡している。**どちらが正なのか（両方受けるのか）は未確認** |
| ステータス設定（個別） | `/projects/{projectKey}/statuses/{statusId}` | ○ | bee `statusUrl()` |
| 種別設定（個別） | `/EditIssueType.action?issueType.id={id}&issueType.projectId={projectId}` | ○ | bee `issueTypeUrl()` |
| カテゴリー設定（個別） | `/EditComponent.action?component.id={id}&component.projectId={projectId}` | ○ | bee `categoryUrl()` |
| マイルストーン（個別・編集） | `/EditVersion.action?version.id={milestoneId}` | ○ | bee `milestoneUrl()` |
| マイルストーン一覧 | ✗ 未確認 | ✗ | — |
| メンバー（プロジェクト参加者一覧） | ✗ 未確認 | ✗ | — |
| プロジェクト設定の各セクション（権限・外部連携など） | ✗ 未確認 | ✗ | — |

### 1.3 その他確認できたパス（参考）

| パス | 用途 | 確度 | 根拠 |
|---|---|---|---|
| `/globalbar/issuefilters.json` | グローバルバーが使う課題フィルタの JSON | ○ | power-ups `projectIssueFilter` が `fetch` している。**公開 API ではない**ため、拡張が依存するのは避ける |
| `/ViewRepositoryFile.action`、`/DownloadRepositoryFile.action` | 旧 SVN ファイル表示・ダウンロード | ○ | power-ups `copyRawFile` |
| `/SpaceImage.action` | スペースのアイコン画像 | ○ | power-ups `favicon` |

**実装への含意**: `.action` 形式のレガシーパスと `/projects/{key}/…` 形式の新パスが混在している。ページ定義は「1 画面 = 1 パステンプレート」ではなく、**別名（alias）を複数持てる形**で持つのが安全。

### 1.4 ページの DOM

| 事実 | 確度 | 根拠 |
|---|---|---|
| ダークモードのとき `<html>` に `dark-mode` クラスが付く。無ければライト | ● | 開発者の実機観察（2026-09-23）。パレットのテーマはこれに揃える（decisions.md D-57） |
| 表示中にテーマを切り替えたとき、再読み込みなしでクラスが付け外しされるか | ✗ | 未確認。パレットは開くたびに読み直すので、どちらでも追従する |

---

## 2. 課題キー / プロジェクトキーの形式

| 事実 | 内容 | 確度 | 根拠 |
|---|---|---|---|
| 課題キーの構造 | `{プロジェクトキー}-{連番}` | ◎/S | スキルに「issueKey は `PROJECT-N` 形式」。公開ユーザーガイドのプロジェクトキー説明にも「課題を表す文字としても使用されます。(例：BLG-52)」 |
| プロジェクトキーに使える文字 | **半角英大文字 (A-Z)・数字 (0-9)・アンダースコア (`_`)** | ◎ | Add Project API の `key` パラメータ説明「Uppercase letters (A-Z), numbers (0-9) and underscore (_) can be used.」 |
| プロジェクトキーの大文字小文字 | 大文字のみ（小文字は使えない） | ◎ | 同上（"Uppercase letters"） |
| プロジェクトキーの長さ | 1〜25 文字 | ▲ | ヘルプセンター記事の検索スニペット由来。原文は 403 で取得できておらず**要検証** |
| プロジェクトキーの先頭文字 | 英字必須かどうか（数字・`_` 始まりが作れるか） | ✗ | 公式 OSS 内でも扱いが割れている（下記）。API ドキュメントに制約の記述なし |
| 連番部分の桁数 | 上限 | ✗ | 記述を見つけられなかった |
| URL / API が小文字の課題キーを受けるか | — | ✗ | power-ups は入力を `toUpperCase()` してから使う（○）＝小文字をそのまま投げていない |
| プロジェクトキー変更の影響 | プロジェクトキーを変更するとプロジェクト内の全リソースの URL が変わる | ▲ | ヘルプセンター記事の検索スニペット由来。原文未取得 |

### 2.1 Nulab 公式 OSS が使っている課題キー正規表現（○）

| 出典 | 正規表現 | 読み取れること |
|---|---|---|
| bee `apps/cli/src/commands/browse-url.ts` | `/^[A-Z][A-Z0-9_]+-\d+$/` | 先頭は英大文字、以降 `[A-Z0-9_]` が **1 文字以上**（＝キーは 2 文字以上）、`-`、数字 1 桁以上 |
| backlog-power-ups `plugins/jumpIssue.ts` | `/[A-Z0-9_]+-[0-9]+/`（入力を `toUpperCase()` した上で適用） | 先頭が数字・`_` でも通す。1 文字キーも通す |

**2 つは一致していない**（先頭英字の要否と最短長）。したがって「Backlog が受理する課題キーの厳密な文法」は公式資料からは確定できない。

### 2.2 本拡張での判定式（この台帳から導いた案、事実ではない）

`docs/implementation-plan.md` §7.1 の「登録済みプロジェクトキー + `-` + 数字」という条件と組み合わせるなら、文字種だけを緩く見て**実在キーとの突き合わせで確定させる**のが安全:

```
候補抽出（NFKC 後・原文の大文字小文字を保ったまま判定）: /^[A-Za-z][A-Za-z0-9_]*-\d+$/
→ 大文字化して、ローカル索引にある実在のプロジェクトキーと完全一致するかで確定
```

- 先頭英字を要求するかは §5 の実測課題。**実測で数字始まりのキーが作れると分かったら `[A-Za-z0-9_]+` に緩める**
- 大文字小文字の受理は未確認なので、**表示・遷移には必ず大文字化した正規形を使う**

---

## 3. API の事実

すべて `https://{space}.{domain}/api/v2/…`（◎ Authentication ドキュメントのベース URL 形式 `https://[space-name].[domain]/api/v2/[endpoint]`）。

### 3.1 認証（◎）

| 事実 | 内容 |
|---|---|
| 方式 | API キー、または OAuth 2.0 の 2 つ |
| API キーの渡し方 | クエリ `?apiKey=…`、または **`Backlog-API-Key` リクエストヘッダ**（ヘッダが使える点は URL にキーが残らないので拡張では必須の選択） |

### 3.2 課題検索 `GET /api/v2/issues`（◎）

| パラメータ | 内容 |
|---|---|
| `keyword` | 説明は「検索キーワード」／英語版も "Keyword" のみ。**一致範囲の記述はない**（→ §3.8） |
| `projectId[]` | プロジェクト ID（複数指定可）。**キーではなく ID** |
| `statusId[]` | 状態 ID（複数指定可）。プロジェクトごとの値はステータス一覧 API で取る |
| `assigneeId[]` | 担当者 ID（複数指定可） |
| `updatedSince` / `updatedUntil` | `yyyy-MM-dd` |
| `count` | 1〜100、既定 20 |
| `offset` | ページング開始位置 |
| `sort` | `issueType` / `category` / `version` / `milestone` / `summary` / `status` / `priority` / `attachment` / `sharedFile` / `created` / `createdUser` / `updated` / `updatedUser` / `assignee` / `startDate` / `dueDate` / `estimatedHours` / `actualHours` / `childIssue` / `customField_${id}` |
| `order` | `asc` / `desc`（既定 `desc`） |
| その他（日本語版ドキュメントに列挙） | `issueTypeId[]` `categoryId[]` `versionId[]` `milestoneId[]` `priorityId[]` `createdUserId[]` `resolutionId[]` `parentChild` `attachment` `sharedFile` `createdSince` `createdUntil` `startDateSince` `startDateUntil` `dueDateSince` `dueDateUntil` `hasDueDate` `id[]` `parentIssueId[]` `expand[]` ＋カスタム属性系 |

**応答の項目**（◎、2026-09-22 に公式ドキュメントの応答例で確認）: `id` `projectId` `issueKey` `keyId`
`issueType` `summary` `description` `resolution` `priority` `status` `assignee` `category` `versions`
`milestone` `startDate` **`dueDate`** `estimatedHours` `actualHours` `parentIssueId` `childIssueSummary`
`createdUser` `created` `updatedUser` `updated` `customFields` `attachments` `sharedFiles` `stars`。
`dueDate` と `startDate` は**既定の応答に含まれる**ので、期限を行に出すのに追加のリクエストは要らない。
`parentIssueId` も含まれるが、親課題の件名は含まれない（表示するには課題ごとに 1 リクエスト要る）

- 件数取得: `GET /api/v2/issues/count`。**課題一覧と同じパラメータ（`keyword` を含む）を受ける**（◎）。実装プラン §18-11「広げれば N 件」の判断材料になる
- `projectId[]` / `statusId[]` / `assigneeId[]` はすべて**数値 ID**。キーや名前では絞れない → マスタの先読み（実装プラン §7.4）は必須

### 3.3 Wiki 検索 `GET /api/v2/wikis`（◎）

| 事実 | 内容 |
|---|---|
| パス / メソッド | `GET /api/v2/wikis` |
| `projectIdOrKey` | **必須**。プロジェクト ID またはプロジェクトキー |
| `keyword` | 任意。「検索キーワード」 |
| レスポンス | `id` / `projectId` / `name` / `tags` / 作成者・更新者・日時などのメタ情報。**本文（content）は含まれない**（英語版ドキュメントに "the response does not include the actual page content" に相当する記述） |
| 件数取得 | `GET /api/v2/wikis` のカウント版が存在（ドキュメント「Wiki ページ数の取得」） |

**実装への含意（重要）**: Wiki 検索は**プロジェクト単位でしか呼べない**。スペース横断の Wiki 検索は「参加プロジェクトを列挙して N 並列で呼ぶ」形になり、レートリミットの Search 枠を一気に消費する。実装プラン §7.4 の並列制御はプロジェクト数に比例する前提で設計する必要がある。またスニペット表示（§6.4）に使える本文がレスポンスに無い。

### 3.4 ドキュメント検索 `GET /api/v2/documents`（◎）

| 事実 | 内容 |
|---|---|
| パス / メソッド | `GET /api/v2/documents` |
| `projectId[]` | プロジェクト ID（複数指定可）。**横断で呼べる**（Wiki と違いプロジェクト必須ではない） |
| `keyword` | 検索キーワード |
| `offset` | **必須** |
| `count` | 1〜100、既定 20 |
| `sort` | `created` / `updated` のみ |
| `order` | `asc` / `desc`（既定 `desc`） |
| レスポンス | `id` `projectId` `title` **`plain`（本文のプレーンテキスト）** `json`（構造化本文） `statusId` `emoji` `attachments` `tags` `createdUser` `created` `updatedUser` `updated` |
| 関連 | `GET /api/v2/documents/{id}`、`GET /api/v2/documents/tree`、`GET /api/v2/documents/count`、`GET /api/v2/documents/{id}/attachments` |

**実装への含意**: `plain` が一覧レスポンスに入るので、ドキュメントだけは**ハイライト付きスニペットを拡張側で作れる**（実装プラン §6.4 の前提が成立するのはドキュメントのみ）。一方で 1 件あたりのレスポンスが重くなる点は実測で見る。

### 3.5 マスタ系（◎）

| 対象 | エンドポイント | 備考 |
|---|---|---|
| プロジェクト一覧 | `GET /api/v2/projects`（`archived`、`all`） | レスポンスに `projectKey` を含む。`all` は管理者のみ有効で既定 `false`（＝参加プロジェクトのみ） |
| スペースのユーザー一覧 | `GET /api/v2/users` | **必要ロール: 管理者 または プロジェクト管理者**。一般ユーザーでは使えない |
| プロジェクトのユーザー一覧 | `GET /api/v2/projects/:projectIdOrKey/users`（`excludeGroupMembers`） | 一般ユーザー向けの現実的な経路 |
| ステータス一覧 | `GET /api/v2/projects/:projectIdOrKey/statuses` | `id` `projectId` `name` `color` `displayOrder`。**プロジェクトごと** |
| 課題種別一覧 | `GET /api/v2/projects/:projectIdOrKey/issueTypes` | `id` `projectId` `name` `color` `displayOrder` `templateSummary` `templateDescription` |

**実装への含意**:
- `@ユーザー` プレフィックス（§7.1）の候補源に `GET /api/v2/users` を前提にすると**一般ユーザーで 403 になる**。プロジェクト単位のユーザー一覧を積み上げる設計にする
- 状態はプロジェクトごとに ID が違う（S: 既定 4 種 + カスタム最大 8 = 1 プロジェクト最大 12）。横断検索でステータスを 1 つ選ばせる UI（D5 の単一選択）でも、内部では**プロジェクトごとの `statusId` 集合に展開**しないと絞り込めない

### 3.6 レートリミット（◎）

| 事実 | 内容 |
|---|---|
| グループ | 4 つ。**Read**（Search / Icon を除く GET）／**Update**（POST・PATCH・DELETE）／**Search**（課題・Wiki の一覧および件数取得）／**Icon**（ロゴ・アイコン取得） |
| 窓 | 1 分（`X-RateLimit-Limit` は「1 分間に受付可能な最大リクエスト数」） |
| 超過時 | HTTP **429 Too Many Requests** |
| レスポンスヘッダ | `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`（UTC epoch 秒） |
| 現在値の取得 | `GET /api/v2/rateLimit` → `{ rateLimit: { read, update, search, icon } }` 各 `{ limit, remaining, reset }` |
| プラン別の実値 | **公開されていない**。ドキュメントは「プランと種別で異なる。現在の上限は取得 API で」と述べるだけ |
| ドキュメントの例に載っている値 | `read: 600` / `update: 150` / `search: 150` / `icon: 60`、および別の例で `X-RateLimit-Limit: 150`。**あくまで例示値であり、自スペースの実値ではない** |

**実装への含意（未決 #5 に直結）**:
- **検索は最も厳しい枠**（Search）に入り、しかも Wiki はプロジェクト単位なので消費が読みにくい。`GET /api/v2/rateLimit` を接続時とバックオフ時に呼んで、トークンバケットの容量を**実値で初期化**できる（推測値をハードコードしなくて済む）
- 429 と `X-RateLimit-Reset` を行内エラー（§13）に載せられる

### 3.7 その他の確認事項

| 項目 | 状態 |
|---|---|
| 通知（お知らせ）API | `GET /api/v2/notifications` に相当するドキュメントページが存在する（● ドキュメント URL が 200）。パラメータ・レスポンスは ✗ 未確認 |
| 最近見た課題の API | ✗ 未確認（`get-recently-viewed-issues` というドキュメントページは存在しない（● 404）。別名の可能性は未調査） |
| OAuth 2.0 のリダイレクト URI 複数登録（未決 #2）、Enterprise での OAuth 可用性（未決 #3） | ✗ 未確認 |

### 3.8 未決事項 #1: `keyword` の一致範囲

| 観点 | 分かったこと | 確度 |
|---|---|---|
| 課題 `GET /api/v2/issues` の `keyword` | 公式 API ドキュメントの説明は**「検索キーワード」／"Keyword" のみ**。件名だけか、詳細・コメントも含むかは**記述されていない** | ◎（＝記述が無いことの確認） |
| Wiki `GET /api/v2/wikis` の `keyword` | 同様に「検索キーワード」のみ。範囲の記述なし | ◎ |
| ドキュメント `GET /api/v2/documents` の `keyword` | 同様に記述なし。ただしレスポンスに `plain` があるため**クライアント側で照合し直せる** | ◎ |
| 製品 UI（本体のキーワード検索）の対象 | 検索スニペットに「コメントの検索対象は変更履歴を含む直近 500 件（投稿日の新しい順）まで。それ以前のコメントは検索結果に含まれない」という記述があった。**原文（ヘルプセンター）は 403 で取得できておらず、また UI の挙動が API `keyword` と同一である保証はない** | ▲ |
| 結論 | **API `keyword` の一致範囲は未確認。** ▲ の記述は「本体 UI では少なくともコメントも対象になりうる」ことを示唆するだけで、API の根拠にはならない | ✗ |

**実装への含意**: 実装プラン §18-1 は解消していない。M1 の実測（検証スペースに「件名のみ一致」「詳細のみ一致」「コメントのみ一致」「500 件より古いコメントのみ一致」の 4 通の課題を作り、`GET /api/v2/issues?keyword=…` と `GET /api/v2/issues/count?keyword=…` の戻りを見る）がそのまま必要。退避先（D5 の「キーワード対象」セレクタ）は残す。

---

## 4. ドメイン

### 4.1 スペースが取りうるホスト

| ホスト形 | 状態 | 確度 | 根拠 |
|---|---|---|---|
| `{space}.backlog.jp` | 現行 | ◎/○ | Authentication ドキュメントの例に登場／backlog4j の URL 例／power-ups の content script `matches` |
| `{space}.backlog.com` | 現行 | ◎/○ | 同上 |
| `{space}.backlogtool.com` | **現行（旧ドメインだが今も対象）** | ◎/○ | Authentication ドキュメントの例に 3 つ目として登場／**Nulab 公式拡張 backlog-power-ups の content script `matches` に `https://*.backlogtool.com/*` が入っている** |
| `{space}.git.backlog.com` / `{space}.git.backlog.jp` | Git のリモートホスト（Web ページではない） | ○ | bee の git リモート解析正規表現 `…@([^.]+)\.git\.(backlog\.(?:com\|jp)):…` |
| Enterprise のカスタムドメイン | 任意のホストになりうる | ✗ | 具体的な形式・制約は未確認（実装プラン §18-12 のまま） |

### 4.2 スペースではないホスト（● 実測 2026-09-10、`https://{host}/` の応答）

| ホスト | 実測結果 | 判定 |
|---|---|---|
| `backlog.com` | 301 → `https://nulab.com/backlog/` | マーケティングサイト。**除外** |
| `www.backlog.com` | 301 → `https://backlog.com/` | 除外 |
| `backlog.jp` | 301 → `https://backlog.com/ja/` | 除外 |
| `www.backlog.jp` | 301 → `https://backlog.com/ja/` | 除外 |
| `backlogtool.com` | 301 → `https://backlog.com/` | 除外 |
| `www.backlogtool.com` | 301 → `https://backlog.com/` | 除外 |
| `support-ja.backlog.com` | 302 → `/hc`（ヘルプセンター） | 除外 |
| `support-en.backlog.com` | 301 → `https://backlog.com/` | 除外 |

### 4.3 `matches` / `excludeMatches` の候補

実装プラン §6.3 の `BACKLOG_MATCHES` は `backlog.jp` と `backlog.com` の 2 つだが、**`backlogtool.com` が抜けている**（Nulab 公式拡張は 3 つ入れている）。

入れるべき候補:

```
https://*.backlog.jp/*
https://*.backlog.com/*
https://*.backlogtool.com/*
```

除外すべきもの（`*.backlog.com` は apex と `www` にもマッチする。実装プラン §6.3 の記述どおり）:

```
https://backlog.com/*
https://www.backlog.com/*
https://backlog.jp/*
https://www.backlog.jp/*
https://backlogtool.com/*
https://www.backlogtool.com/*
https://support-ja.backlog.com/*
https://support-en.backlog.com/*
```

- Enterprise のカスタムドメインは静的 `matches` では拾えない（`optional_host_permissions` + 動的登録。実装プラン §18-12）
- `{space}.git.backlog.com` はクローン用ホストで Web ページを持たないため、`matches` に足す意味はない（害もない）。**除外リストに入れる必要があるかは未確認**
- `nulab.com` / `developer.nulab.com` は `*.backlog.*` にマッチしないので対処不要

---

## 5. 実測で確認すべき項目

M1（API 検証）と M2 の着手前に、検証スペースで確認する。**上から順に、実装方針を変える度合いが大きい。**

| # | 確認すること | 影響 | 対応する未決事項 |
|---|---|---|---|
| 1 | `GET /api/v2/issues` の `keyword` が **件名 / 詳細 / コメント** のどこに一致するか（コメントは直近 500 件までという ▲ の記述も含めて） | サイドパネル検索の方針全体。件名のみなら `plain` 取得＋クライアント照合という重い代替が必要 | #1 |
| 2 | `GET /api/v2/wikis` / `GET /api/v2/documents` の `keyword` の一致範囲（Wiki は本文がレスポンスに無いため、照合が API 側にしか無い） | Wiki 検索を Phase 1 に入れられるか | #1 |
| 3 | 自スペースの `GET /api/v2/rateLimit` 実値（read / update / search / icon）と、Search 枠を Wiki のプロジェクト並列で使い切るまでの実回数 | 並列数、既定スコープ、件数予告（#11）の可否 | #5 |
| 4 | プロジェクトキーの**先頭に数字・`_` を使えるか**、および**最短 1 文字**が作れるか（公式 OSS の正規表現が矛盾している） | §7.1 の課題キー判定の正規表現 | — |
| 5 | プロジェクトキーの最大長（▲ 25 文字の裏取り） | 同上 | — |
| 6 | 課題キーを**小文字**で `/view/proj-123` に投げたときの挙動（リダイレクトされるか 404 か） | 入力の正規化（大文字化して遷移するかそのまま渡すか） | — |
| 7 | 課題の追加ページの正確なパス（`/add/` の第 2 セグメント） | Phase 1 のページ移動 | — |
| 8 | お知らせ / 担当している課題 / 個人設定 / スペース設定 / メンバー / マイルストーン一覧 / プロジェクト設定各セクションの URL | Phase 1 のページ移動の対象が埋まらない | — |
| 9 | プロジェクト設定が `EditProject.action?project.key=` と `project.id=` の**どちらを受けるか**（両方か） | ページ移動の URL 生成 | — |
| 10 | 課題一覧 `/find/{projectKey}` のクエリ文字列の仕様（絞り込み条件・保存済みフィルタの表現） | Phase 2 の保存済み検索、および D4 の条件引き渡し | — |
| 11 | `GET /api/v2/notifications`（お知らせ）のパラメータとレスポンス | Phase 2 のお知らせ既読 | — |
| 12 | Enterprise カスタムドメインの実際の形式と、`{space}.git.backlog.*` を除外すべきか | `matches` と動的登録 | #12 |
| 13 | 一般ユーザー権限（管理者でない）で `GET /api/v2/users` が実際に 403 になるか、その場合のメッセージ | `@ユーザー` 候補の取得経路 | — |
| 14 | ドキュメント一覧の `plain` を含むレスポンスの実サイズと所要時間 | プレビュー・スニペットの実現性、§14 のパフォーマンス予算 | — |
| 15 | `Backlog-API-Key` ヘッダ付きの fetch（拡張ページから、`Origin: chrome-extension://…`）が CORS のプリフライトを通るか。`?apiKey=` クエリでの挙動との比較 | 拡張ページから API を直接呼ぶ設計（`requirements/tech-stack.md` T-2）。通らなければクエリに切り替える | 2026-09-13 追記 |
| 16 | Web ページに埋めた拡張 iframe から、Chrome と Firefox の両方で `tabs.query` / `tabs.update` と cross-origin fetch が使えるか | 同上。使えないブラウザでは SW に委譲する | 2026-09-13 追記 |
| 17 | `@wxt-dev/storage` の `defineItem().watch` が拡張ページ間（iframe・サイドパネル・設定）で確実に届くか | TanStack DB コレクションの同期（T-1） | 2026-09-13 追記 |

---

### 5.1 M3 の E2E で確かめたこと（● 2026-09-13、偽スペース + Chromium・Firefox）

偽スペースを `--host-resolver-rules`（Chromium）と CONNECT プロキシ（Firefox）で `demo.backlog.jp` に見せ、ビルドした拡張を読み込んで確認した。

| # | 確認したこと | 結果 | 含意 |
|---|---|---|---|
| 15 | 拡張オリジン（埋め込み iframe・Service Worker）からスペースへの `Backlog-API-Key` ヘッダ付き fetch | **Chrome ではプリフライトを受けない。** content script の `matches` がホスト権限として扱われ、ヘッダ付きでも単純リクエストとして届く。プリフライトが問題になるのは権限を持たないカスタムドメイン（`requirements/surfaces.md` §8）だけ | ヘッダ認証（T-2）は Chrome では成立する。`?apiKey=` への退避はカスタムドメインと Firefox のために残す |
| 16 | Web ページに埋めた拡張 iframe から `tabs.getCurrent()` | **Chrome では自分のタブを返す。** iframe の中でタブ URL を読み、スペースを決められる | I7 の「拡張ページが自分でタブ URL を読む」は Chrome で成立 |
| 16-F | 同じことを Firefox（Puppeteer の WebDriver BiDi で一時インストール）で | **Firefox では埋め込み iframe に `browser.tabs` が無い**（content script 相当の権限になる）。**fetch は CORS を受ける**（Chrome と違い `matches` のホスト権限が効かず、プリフライトを拒まれると NetworkError） | Firefox では iframe → background への委譲（`requirements/tech-stack.md` §5-16 の退避）が要る。tabs は `lib/tabs`、API の fetch は差し替え fetch（D-31）の 1 点で委譲する（D-33） |

## 6. 出典一覧

| 種別 | 出典 |
|---|---|
| 公式 API ドキュメント | `https://developer.nulab.com/docs/backlog/`（Authentication、Rate Limit、Get Issue List、Count Issue、Get Wiki Page List、Get Document List、Get Project List、Get User List、Get Project User List、Get Status List of Project、Get Issue Type List、Get Rate Limit、Add Project）および日本語版 `/ja/docs/backlog/…` |
| 公開ユーザーガイド | `https://backlog.com/ja/enterprise-help/userguide/`（プロジェクトの追加・リンク記法・キーワード検索） |
| Nulab 公開 OSS | `github.com/nulab/bee`、`github.com/nulab/backlog-power-ups`、`github.com/nulab/backlog4j` |
| 社内スキル | `backlog-product`（課題キー形式、状態のプロジェクト単位性、ダッシュボードの構成などの製品事実） |
| 実測 | 2026-09-10 の HTTP 応答（§4.2、ドキュメントページの存在確認） |
| 取得できなかった資料 | `support-ja.backlog.com` / `support-en.backlog.com`（403）。ここにしかない事項は ▲ または ✗ のまま |

---

## 6. 実測結果（2026-09-10、`bee api` で確認）

自スペースに対する読み取りのみ。内容は記載せず、判定結果と構造だけを残す。

### 6.1 `keyword` の一致範囲（未決 #1 → **解決**）

判定方法: 件名に無く本文にだけ含まれる語を実データから選び、`keyword` に投げて元の項目が返るかを見る。件名にある語での対照実験も行い、検索そのものが機能していることを確認した。

| 対象 | 結果 | 根拠 |
|---|---|---|
| 課題 `GET /issues` | **本文にも一致する** | ● 本文にのみ含まれる語で当該課題が返った（対照: 件名の語でも返る） |
| 課題コメント | **一致する** | ● 件名にも本文にも無く、コメントにのみ含まれる語で当該課題が返った |
| Wiki `GET /wikis` | **本文にも一致する** | ● 本文にのみ含まれる語で当該 Wiki が返った |

**含意**: サイドパネル検索で `plain` を取得してクライアント側で照合する重い代替は不要。「キーワード対象」セレクタは劣化の退避先ではなく、絞り込みの選択肢として置ける。

### 6.2 レートリミット（未決 #5 → **解決**）

`GET /api/v2/rateLimit` が実値を返す（自スペースでの実測値）。

| 枠 | limit |
|---|---|
| `read` | 600 |
| `update` | 150 |
| `search` | 150 |
| `icon` | 60 |

`reset` は Unix 時刻。**値をハードコードせず、接続時にこの API で初期化する。**課題・Wiki の検索は `search` 枠（150）を消費するため、全スペース並列の本数はここから決める。

### 6.3 レスポンスの中身（台帳 §3 の訂正を含む）

| 事実 | 結果 |
|---|---|
| `GET /wikis` の一覧に**本文 `content` が含まれる** | ● 含まれる。**「本文が返らない」は誤りだった**。Wiki もハイライト付きスニペットを作れる |
| `GET /wikis` に `count` が効かない | ● `count=5` を付けても全件（実測 956 件）返った。ただし `keyword` を付ければサーバ側で絞られるので、検索用途では問題にならない。**キーワード無しの一覧取得は避ける** |
| `GET /documents` は `projectIds[]` と `offset` を取る | ● 既定 20 件。`plain`・`json`・`title`・`statusId`・`tags`・`emoji` を含む |
| `GET /issues` はパラメータ無しだとエラー | ● `projectId[]` の指定が要る |

### 6.4 OAuth 2.0（公式ドキュメントで確認、2026-09-10）

| 項目 | 値 | 根拠 |
|---|---|---|
| 認可エンドポイント | `GET /OAuth2AccessRequest.action` | ◎ developer.nulab.com |
| トークンエンドポイント | `POST /api/v2/oauth2/token` | ◎ 同上 |
| 認可リクエストのパラメータ | `response_type=code` / `client_id` / `redirect_uri` / `state`（任意） | ◎ 同上 |
| `scope` | **記載なし**（送らない） | ◎ 同上 |
| **PKCE** | **非対応**（`code_challenge` の記載が無い） | ◎ 同上 |
| **`client_secret`** | **トークン要求に必須** | ◎ 同上 |
| アクセストークンの寿命 | 3600 秒 | ◎ 同上 |
| リフレッシュ | `grant_type=refresh_token` + `client_id` + `client_secret` + `refresh_token` | ◎ 同上 |

**含意（重要）**: PKCE が使えず `client_secret` が必須なので、**ブラウザ拡張はシークレットを隠せない**。配布物に含めれば取り出せる。設計上の扱いは実装プラン §10 に記録する。

### 6.5 OAuth のスペース横断（実機で確認、2026-09-10）

| 事実 | 結果 |
|---|---|
| 1 つの OAuth クライアントで複数スペースを認可できるか | ● **できる。**あるスペースで登録した client_id を、他のスペースの認可エンドポイントにそのまま使える |

**含意**: スペースを増やすたびの OAuth アプリ登録が要らない。2 つ目以降のスペースも「接続」1 回で繋がるので、スペース横断（実装プラン §1）が OAuth のまま成立する。

## 7. ページの見た目（プロジェクトテーマ）

出典: `https://assets.backlog.com/playassets/1.84.0/styles/ReactApp.css`（● 2026-09-23 に取得して読んだ。
版が上がると URL の `1.84.0` が変わる）と、実機の DevTools（● 2026-09-23、theme-orange）。

### 7.1 宣言のされ方

| 事実 | 内容 |
|---|---|
| 既定値 | `:root` にデザイントークン一式を宣言する。テーマ変数の既定は緑（Main `#4caf93` / Accent `#2c9a7a` / Link `#00836b` ほか） |
| プロジェクトテーマ | `body:not(.Page--error):not(.Page--add-space).theme-<name>` が `--defaultColor*` を上書きする |
| テーマ名 | aqua / azuki / black / gray / orange / pink / purple / sakura / ultramarine / army / ethnic / leopard / pink-leopard / acrylic（14 種）。クラスが無ければ `:root` の緑 |
| ダークモード | 祖先に `.dark-mode` があると `.dark-mode body:not(...)` が text / border / background 系と `--defaultColor*` を再定義する。テーマごとの上書きもある（`.dark-mode body:not(...).theme-<name>`）。ダークのテーマ上書きは Main / Accent / Accent-rgb / Link だけで、Base / Base-rgb / Base-2 は全テーマ共通で `[class*=theme-]` が面の色に寄せる。Sub-1 はライトのテーマ値が残る |
| 値の形 | 色は `#rrggbb`（大文字小文字は混在）。`-rgb` 付きは `r,g,b`（空白なし）。ダークの Base / Base-2 は `var(--backgroundColor*)` 参照で、computed style では解決後の hex が返る |
| 片寄った変数 | `--defaultColorMainInverse` はダークの black / gray / army / acrylic にだけある |

theme-orange の値（ライト / ダーク）:

| 変数 | ライト | ダーク |
|---|---|---|
| `--defaultColorMain` | `#ea733b` | `#d4642f` |
| `--defaultColorAccent` | `#de5514` | `#C3542D` |
| `--defaultColorAccent-rgb` | `222,85,20` | `210,93,60` |
| `--defaultColorBase` | `#f3e6e2` | `#3e3e3e`（`var(--backgroundColorWeak)`） |
| `--defaultColorBase-rgb` | `243,230,226` | `62,62,62` |
| `--defaultColorBase-2` | `#f7ebe9` | `#333333`（`var(--backgroundColorSchemeBase)`） |
| `--defaultColorLink` | `#c14524` | `#ff9454` |
| `--defaultColorSub-1` | `#ECA08B` | `#ECA08B` |
| `--backgroundColorSchemeBase` | `#ffffff` | `#333333` |

### 7.2 Backlog 本体での使い分け（ReactApp.css の参照箇所から）

| 変数 | 主な使われ方 |
|---|---|
| Accent | 主ボタンの塗りと縁（`.button--primary`）、アイコンの fill、選択中の下線。参照数が最多 |
| Accent-rgb | 選択面 `rgba(…, .25)`（`.selectbox--multiple__item.is_selected`）、ホバー面 `rgba(…, .075)`〜`.2` |
| `--backgroundColorSchemeBase` | 主ボタンの文字色（Accent の塗りの上） |
| Link | リンク文字色、入力欄フォーカスの縁と `box-shadow: 0 0 3px` |
| Base / Base-2 | 淡い面（選択済み絵文字、既定ボタンのホバー面） |
| Main | ヘッダーなど面の塗り。参照は少ない |
| Sub-1 | 一部の縁と面。参照は少ない |

`.dark-mode` が付く要素はセレクタからは body の祖先としか言えないが、実機では `<html>` に付く（§1.4）。
