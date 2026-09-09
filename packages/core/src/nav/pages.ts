/**
 * ページ移動の定義（実装プラン §3.1）。
 *
 * URL は docs/backlog-facts.md の台帳に基づく。ここは「どこへ行けるか」の
 * 一覧であって、遷移そのものは行わない（遷移は Service Worker の責務、§2.3）。
 */

export type NavContext = {
  /** `https://{space}.backlog.com` のようなオリジン */
  origin: string;
  projectKey?: string;
  /** 数値のプロジェクト ID。一部のレガシーページがキーではなくこれを要求する */
  projectId?: number;
};

export type PageDefinition = {
  id: string;
  label: string;
  /** 英字で打っても引けるようにする別名 */
  aliases: readonly string[];
  scope: 'space' | 'project';
  /** 必要な文脈が揃わなければ undefined。候補から落とす */
  build: (ctx: NavContext) => string | undefined;
};

const path = (ctx: NavContext, suffix: string) => `${ctx.origin}${suffix}`;

const withProjectKey =
  (suffix: (projectKey: string) => string) =>
  (ctx: NavContext): string | undefined =>
    ctx.projectKey === undefined ? undefined : path(ctx, suffix(ctx.projectKey));

export const SPACE_PAGES: readonly PageDefinition[] = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    aliases: ['dashboard', 'home', 'ホーム', '担当している課題', '自分の課題'],
    scope: 'space',
    build: (ctx) => path(ctx, '/dashboard'),
  },
  {
    id: 'personal-settings',
    label: '個人設定',
    aliases: ['profile', 'settings', 'せってい'],
    scope: 'space',
    build: (ctx) => path(ctx, '/EditProfile.action'),
  },
  {
    id: 'space-settings',
    label: 'スペース設定',
    aliases: ['space settings', 'admin'],
    scope: 'space',
    build: (ctx) => path(ctx, '/EditSpace.action'),
  },
  {
    id: 'members',
    label: 'メンバー',
    aliases: ['members', 'users', 'ユーザー'],
    scope: 'space',
    /*
     * ページング引数を付けたまま登録する。省くと 1 件も表示されない画面が
     * あるため、実際にブラウザが出す URL をそのまま使う。
     */
    build: (ctx) => path(ctx, '/ListUser.action?q.limit=20&q.offset=0'),
  },
];

export const PROJECT_PAGES: readonly PageDefinition[] = [
  {
    id: 'project-home',
    label: 'プロジェクトホーム',
    aliases: ['home', 'project'],
    scope: 'project',
    build: withProjectKey((key) => `/projects/${key}`),
  },
  {
    id: 'issues',
    label: '課題一覧',
    aliases: ['issues', 'find', 'かだい'],
    scope: 'project',
    build: withProjectKey((key) => `/find/${key}`),
  },
  {
    id: 'add-issue',
    label: '課題の追加',
    aliases: ['add issue', 'new issue', 'ついか'],
    scope: 'project',
    build: withProjectKey((key) => `/add/${key}`),
  },
  {
    id: 'board',
    label: 'ボード',
    aliases: ['board', 'kanban'],
    scope: 'project',
    build: withProjectKey((key) => `/board/${key}`),
  },
  {
    id: 'gantt',
    label: 'ガントチャート',
    aliases: ['gantt', 'chart'],
    scope: 'project',
    build: withProjectKey((key) => `/gantt/${key}`),
  },
  {
    id: 'wiki',
    label: 'Wiki',
    aliases: ['wiki'],
    scope: 'project',
    build: withProjectKey((key) => `/wiki/${key}`),
  },
  {
    id: 'document',
    label: 'ドキュメント',
    aliases: ['document', 'docs'],
    scope: 'project',
    build: withProjectKey((key) => `/document/${key}`),
  },
  {
    id: 'files',
    label: 'ファイル',
    aliases: ['file', 'files'],
    scope: 'project',
    build: withProjectKey((key) => `/file/${key}`),
  },
  {
    id: 'git',
    label: 'Git',
    aliases: ['git', 'repository'],
    scope: 'project',
    build: withProjectKey((key) => `/git/${key}`),
  },
  {
    id: 'subversion',
    label: 'SVN',
    aliases: ['svn', 'subversion'],
    scope: 'project',
    build: withProjectKey((key) => `/subversion/${key}`),
  },
  {
    id: 'milestones',
    label: 'マイルストーン',
    aliases: ['milestone', 'version'],
    scope: 'project',
    /*
     * ここだけプロジェクトキーではなく数値 ID を要求する。ID を持たない
     * 文脈では候補に出さない。キーで組み立てて 404 に飛ばすよりよい。
     */
    build: (ctx) =>
      ctx.projectId === undefined
        ? undefined
        : path(ctx, `/ListVersion.action?projectId=${ctx.projectId}`),
  },
  {
    id: 'project-settings',
    label: 'プロジェクト設定',
    aliases: ['project settings'],
    scope: 'project',
    build: withProjectKey((key) => `/EditProject.action?project.key=${key}`),
  },
];

export const ALL_PAGES: readonly PageDefinition[] = [...SPACE_PAGES, ...PROJECT_PAGES];

export function issueUrl(origin: string, issueKey: string): string {
  return `${origin}/view/${issueKey}`;
}

/** 文脈で組み立てられるページだけを返す */
export function availablePages(ctx: NavContext): readonly (PageDefinition & { url: string })[] {
  const built: (PageDefinition & { url: string })[] = [];
  for (const page of ALL_PAGES) {
    const url = page.build(ctx);
    if (url !== undefined) built.push({ ...page, url });
  }
  return built;
}
