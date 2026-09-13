import type { Scope } from '@/lib/stack/types';

import type { CachedEntry, PaletteIndex, ProjectEntry, SpaceEntry } from './model';

/** derive のテスト用索引。日本語の現実的なダミーで、fixtures/domain.ts と同じ世界 */
export const DAY = 24 * 60 * 60 * 1000;
export const now = Date.UTC(2026, 8, 13);

export const nulab: SpaceEntry = {
  id: 'nulab',
  label: 'ヌーラボ',
  host: 'nulab.backlog.com',
  connected: true,
  url: 'https://nulab.backlog.com/dashboard',
};
export const acme: SpaceEntry = {
  id: 'acme',
  label: 'Acme Inc.',
  host: 'acme.backlog.jp',
  connected: true,
  url: 'https://acme.backlog.jp/dashboard',
};
export const beta: SpaceEntry = {
  id: 'beta',
  label: 'ベータ開発',
  host: 'beta.backlogtool.com',
  connected: false,
  url: 'https://beta.backlogtool.com/dashboard',
};

export const web: ProjectEntry = {
  id: '1',
  key: 'PROJ',
  name: 'Webリニューアル',
  spaceId: 'nulab',
  url: 'https://nulab.backlog.com/projects/PROJ',
};
export const mobile: ProjectEntry = {
  id: '2',
  key: 'MOB',
  name: 'モバイルアプリ v3',
  spaceId: 'nulab',
  url: 'https://nulab.backlog.com/projects/MOB',
};
export const helpdesk: ProjectEntry = {
  id: '9',
  key: 'HELP',
  name: '社内ヘルプデスク',
  spaceId: 'acme',
  url: 'https://acme.backlog.jp/projects/HELP',
};

const issue = (
  key: string,
  title: string,
  project: ProjectEntry,
  assignee?: string,
): CachedEntry => ({
  kind: 'issue',
  id: key,
  key,
  title,
  spaceId: project.spaceId,
  projectId: project.id,
  projectName: project.name,
  assignee,
  status: { label: '未対応', tone: 'neutral' },
  url: `https://nulab.backlog.com/view/${key}`,
});

export const payment = issue(
  'PROJ-142',
  '決済フローのエラーハンドリングを見直す',
  web,
  '田中 拓也',
);
export const login = issue(
  'PROJ-118',
  'ログイン画面のバリデーションが日本語入力で崩れる',
  web,
  '佐藤 美咲',
);
export const password = issue('PROJ-120', 'パスワード再設定メールが届かない', web, '佐藤 美咲');
export const pushNotice = issue(
  'MOB-77',
  'プッシュ通知の受信設定をオンボーディングに組み込む',
  mobile,
);
export const loginWiki: CachedEntry = {
  kind: 'wiki',
  id: 'w1',
  title: 'ログイン仕様メモ',
  spaceId: 'nulab',
  projectId: '1',
  projectName: web.name,
  updatedBy: '佐藤 美咲',
  url: 'https://nulab.backlog.com/alias/wiki/1',
};

const projectPages = (key: string) => [
  {
    id: 'issues',
    title: '課題一覧',
    aliases: ['issues', 'かだい'],
    kind: 'issues',
    url: `/find/${key}`,
  },
  {
    id: 'board',
    title: 'ボード',
    aliases: ['board', 'ぼーど'],
    kind: 'board',
    url: `/board/${key}`,
  },
  {
    id: 'gantt',
    title: 'ガントチャート',
    aliases: ['gantt', 'がんと'],
    kind: 'gantt',
    url: `/gantt/${key}`,
  },
  { id: 'wiki', title: 'Wiki', aliases: ['wiki', 'うぃき'], kind: 'wiki', url: `/wiki/${key}` },
  {
    id: 'add-issue',
    title: '課題の追加',
    aliases: ['add issue', 'ついか'],
    kind: 'add-issue',
    url: `/add/${key}`,
  },
  {
    id: 'files',
    title: 'ファイル',
    aliases: ['file', 'ふぁいる'],
    kind: 'files',
    url: `/file/${key}`,
  },
];

export const pagesFor = (scope: Scope) => {
  switch (scope.kind) {
    case 'root':
      return [
        {
          id: 'personal-settings',
          title: '個人設定',
          aliases: ['settings'],
          kind: 'settings',
          url: '/x',
        },
        {
          id: 'api-key-settings',
          title: 'API キーの設定',
          aliases: ['api key'],
          kind: 'api',
          url: '/y',
        },
      ];
    case 'space':
      return [
        {
          id: 'dashboard',
          title: 'ダッシュボード',
          aliases: ['dashboard', 'home'],
          kind: 'dashboard',
          url: '/dashboard',
        },
      ];
    case 'project':
      return projectPages(scope.projectId === '1' ? 'PROJ' : 'MOB');
    default:
      return [];
  }
};

export const index: PaletteIndex = {
  spaces: [nulab, acme, beta],
  projects: [web, mobile, helpdesk],
  pagesFor,
  issueUrl: (spaceId, key) => `https://${spaceId}.backlog.com/view/${key}`,
  externalSearchUrl: (scope, query) =>
    `https://nulab.backlog.com/FindIssueAllOver.action?scope=${scope.kind}&q=${query}`,
  cache: [payment, login, password, pushNotice, loginWiki],
  assigned: [login, password],
  activity: [
    { entityId: 'issue:PROJ-142', at: now - DAY },
    { entityId: 'issue:PROJ-142', at: now - 2 * DAY },
    { entityId: 'page:board', at: now - DAY },
    { entityId: 'issue:MOB-77', at: now - 3 * DAY },
    { entityId: 'project:9', at: now - 5 * DAY },
  ],
  transitions: [
    { from: 'issue', to: 'board', at: now - DAY },
    { from: 'issue', to: 'board', at: now - 2 * DAY },
  ],
  currentPageKind: 'issue',
  currentIssue: { key: 'PROJ-142', title: payment.title, url: payment.url },
  learningEnabled: true,
  now,
};
