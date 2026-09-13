/*
 * 偽スペースの API が返すデータ。形は docs/backlog-facts.md §3・§6.3 に合わせる。
 * 中身は架空。実スペースの値は書かない。
 */
export const TESTER = { id: 1, userId: 'tester', name: 'テスト太郎', roleType: 2, lang: 'ja' };

export const PROJECTS = [
  { id: 101, projectKey: 'PROJ', name: 'Webリニューアル', archived: false, useWiki: true },
  { id: 102, projectKey: 'MOB', name: 'モバイルアプリ v3', archived: false, useWiki: true },
];

function status(projectId: number, id: number, name: string, color: string, order: number) {
  return { id, projectId, name, color, displayOrder: order };
}

/** ステータスはプロジェクトごとに ID が違う（backlog-facts.md §3.5） */
export const STATUSES: Record<number, ReturnType<typeof status>[]> = {
  101: [
    status(101, 1, '未対応', '#ed8077', 1000),
    status(101, 2, '処理中', '#4488c5', 2000),
    status(101, 3, '処理済み', '#5eb5a6', 3000),
    status(101, 4, '完了', '#b0be3c', 4000),
    status(101, 10101, 'レビュー待ち', '#e87758', 2500),
  ],
  102: [
    status(102, 1, '未対応', '#ed8077', 1000),
    status(102, 2, '処理中', '#4488c5', 2000),
    status(102, 3, '処理済み', '#5eb5a6', 3000),
    status(102, 4, '完了', '#b0be3c', 4000),
  ],
};

export const ISSUE_TYPES: Record<number, object[]> = {
  101: [
    { id: 1001, projectId: 101, name: 'タスク', color: '#7ea800', displayOrder: 0 },
    { id: 1002, projectId: 101, name: 'バグ', color: '#990000', displayOrder: 1 },
  ],
  102: [{ id: 1003, projectId: 102, name: 'タスク', color: '#7ea800', displayOrder: 0 }],
};

function issue(
  projectId: number,
  projectKey: string,
  keyId: number,
  summary: string,
  description: string,
  statusId: number,
) {
  const statusRow = STATUSES[projectId]?.find((s) => s.id === statusId) ?? STATUSES[101]?.[0];
  return {
    id: projectId * 1000 + keyId,
    projectId,
    issueKey: `${projectKey}-${keyId}`,
    keyId,
    summary,
    description,
    issueType: ISSUE_TYPES[projectId]?.[0],
    status: statusRow,
    priority: { id: 3, name: '中' },
    assignee: TESTER,
    createdUser: TESTER,
    created: '2026-09-01T09:00:00Z',
    updatedUser: TESTER,
    updated: '2026-09-09T09:00:00Z',
  };
}

export type FakeIssue = ReturnType<typeof issue>;

export const ISSUES: FakeIssue[] = [
  issue(101, 'PROJ', 123, 'ログイン画面のバリデーション修正', '入力エラーの文言が英語のまま。', 2),
  issue(101, 'PROJ', 142, '決済フローのエラーハンドリング', '決済失敗時に白画面になる。', 1),
  issue(101, 'PROJ', 118, '請求書の発行フローを見直す', '月末の請求書発行が手作業のまま。', 4),
  issue(102, 'MOB', 7, 'プッシュ通知の設定画面', '通知のオンオフを端末ごとに保存する。', 1),
];

export const WIKIS = [
  {
    id: 5001,
    projectId: 101,
    name: 'リリース手順',
    content: '## 手順\n1. タグを打つ\n2. デプロイする',
    tags: [{ id: 1, name: '運用' }],
    createdUser: TESTER,
    created: '2026-08-01T09:00:00Z',
    updatedUser: TESTER,
    updated: '2026-09-01T09:00:00Z',
  },
  {
    id: 5002,
    projectId: 101,
    name: 'Home',
    content: 'プロジェクトの入り口。',
    tags: [],
    createdUser: TESTER,
    created: '2026-07-01T09:00:00Z',
    updatedUser: TESTER,
    updated: '2026-07-01T09:00:00Z',
  },
];

export const DOCUMENTS = [
  {
    id: 'doc-a1B2c3',
    projectId: 101,
    title: '決済まわりの仕様メモ',
    plain: '決済プロバイダの切り替え条件と、失敗時のリトライ回数。',
    json: {},
    statusId: 1,
    emoji: '💳',
    attachments: [],
    tags: [],
    createdUser: TESTER,
    created: '2026-08-15T09:00:00Z',
    updatedUser: TESTER,
    updated: '2026-09-05T09:00:00Z',
  },
];
