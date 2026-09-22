/**
 * ページ定義（palette.md §5 の `page` 行、§9 の「{プロジェクト} のページ」）。
 * URL は docs/backlog-facts.md §1 の台帳で ○ のものだけを使い、再調査しない。
 * `.action` 形式と `/projects/{key}/…` 形式が混在するので、1 画面が複数の別名パスを持てる形にする。
 */
export type PageScope = 'common' | 'space' | 'project';

export type PageContext = {
  /** `https://{space}.backlog.com` のようなオリジン */
  origin: string;
  projectKey?: string;
};

export type PageDefinition = {
  id: string;
  /** 表示名。ブラウザの UI 言語で選ぶ（D-11） */
  title: { ja: string; en: string };
  /** 英字の別名とかなの読み。ローマ字入力はかなの読みに届く（D-15） */
  aliases: readonly string[];
  scope: PageScope;
  /** このページと判定するパス。先頭が正規のパスで、残りは別名（レガシーの .action など） */
  paths: readonly RegExp[];
  /**
   * パスに識別子が無く、クエリが識別子になっている画面のためのクエリ名。
   * 落とすと別のプロジェクトの画面が同じ URL になる（`canonicalPath`）
   */
  identityQuery?: string;
  /** 文脈が足りなければ undefined。候補から落とす */
  build: (context: PageContext) => string | undefined;
};

const spacePath =
  (suffix: string) =>
  ({ origin }: PageContext): string =>
    `${origin}${suffix}`;

const projectPath =
  (suffix: (key: string) => string) =>
  ({ origin, projectKey }: PageContext): string | undefined =>
    projectKey === undefined ? undefined : `${origin}${suffix(projectKey)}`;

const KEY = String.raw`(?<projectKey>[A-Z][A-Z0-9_]*)`;
const project = (segment: string): RegExp => new RegExp(`^/${segment}/${KEY}/?$`, 'u');

/**
 * 根で出す共通のページ（個人設定・API キーの設定、D-20）は URL が台帳で ✗ のまま
 * （backlog-facts.md §1.1）。実機で確認できるまで定義に入れない
 */
export const pages: readonly PageDefinition[] = [
  {
    id: 'dashboard',
    title: { ja: 'ダッシュボード', en: 'Dashboard' },
    aliases: ['dashboard', 'home', 'だっしゅぼーど', 'ほーむ'],
    scope: 'space',
    paths: [/^\/dashboard\/?$/u],
    build: spacePath('/dashboard'),
  },
  {
    id: 'all-issues',
    title: { ja: '課題の全体検索', en: 'Search all issues' },
    aliases: ['find issue all over', 'all issues', 'ぜんたいけんさく'],
    scope: 'space',
    paths: [/^\/FindIssueAllOver\.action$/u],
    build: spacePath('/FindIssueAllOver.action'),
  },
  {
    id: 'project-home',
    title: { ja: 'プロジェクトホーム', en: 'Project home' },
    aliases: ['project home', 'home', 'ほーむ'],
    scope: 'project',
    paths: [project('projects')],
    build: projectPath((key) => `/projects/${key}`),
  },
  {
    id: 'issues',
    title: { ja: '課題一覧', en: 'Issues' },
    aliases: ['issues', 'find', 'かだい', 'かだいいちらん'],
    scope: 'project',
    paths: [project('find')],
    build: projectPath((key) => `/find/${key}`),
  },
  {
    id: 'board',
    title: { ja: 'ボード', en: 'Board' },
    aliases: ['board', 'kanban', 'ぼーど'],
    scope: 'project',
    paths: [project('board')],
    build: projectPath((key) => `/board/${key}`),
  },
  {
    id: 'gantt',
    title: { ja: 'ガントチャート', en: 'Gantt chart' },
    aliases: ['gantt', 'chart', 'がんと', 'がんとちゃーと'],
    scope: 'project',
    paths: [project('gantt')],
    build: projectPath((key) => `/gantt/${key}`),
  },
  {
    id: 'wiki',
    title: { ja: 'Wiki', en: 'Wiki' },
    aliases: ['wiki', 'うぃき'],
    scope: 'project',
    paths: [project('wiki')],
    build: projectPath((key) => `/wiki/${key}`),
  },
  {
    id: 'documents',
    title: { ja: 'ドキュメント', en: 'Documents' },
    aliases: ['document', 'docs', 'どきゅめんと'],
    scope: 'project',
    paths: [project('document')],
    build: projectPath((key) => `/document/${key}`),
  },
  {
    id: 'files',
    title: { ja: 'ファイル', en: 'Files' },
    aliases: ['file', 'files', 'ふぁいる'],
    scope: 'project',
    paths: [project('file')],
    build: projectPath((key) => `/file/${key}`),
  },
  {
    id: 'git',
    title: { ja: 'Git', en: 'Git' },
    aliases: ['git', 'repository', 'りぽじとり'],
    scope: 'project',
    paths: [project('git')],
    build: projectPath((key) => `/git/${key}`),
  },
  {
    id: 'subversion',
    title: { ja: 'Subversion', en: 'Subversion' },
    aliases: ['svn', 'subversion'],
    scope: 'project',
    paths: [project('subversion')],
    build: projectPath((key) => `/subversion/${key}`),
  },
  {
    id: 'project-settings',
    title: { ja: 'プロジェクト設定', en: 'Project settings' },
    aliases: ['project settings', 'settings', 'せってい'],
    scope: 'project',
    // 台帳では project.key= と project.id= の両方が公式 OSS にあり、どちらが正か未確認。
    // 遷移には bee のテストが使う project.key= を採る
    paths: [/^\/EditProject\.action$/u],
    identityQuery: 'project.key',
    build: projectPath((key) => `/EditProject.action?project.key=${key}`),
  },
];

export function pagesFor(scope: PageScope, context: PageContext): PageDefinition[] {
  return pages.filter((page) => page.scope === scope && page.build(context) !== undefined);
}
