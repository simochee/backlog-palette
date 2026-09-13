/**
 * 日本語の現実的なダミー。目的は長さと記号の混在を再現すること（ui-components.md §4）。
 */
const spaceIcon = (letter: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="${color}"/><text x="10" y="14" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#fff">${letter}</text></svg>`,
  )}`;

/** label は表示名（スペース名）。キーは利用者の語彙ではないので UI に出さない。icon は API のスペース画像の代わり */
export const spaces = {
  nulab: {
    id: 'nulab',
    label: 'ヌーラボ',
    host: 'nulab.backlog.com',
    icon: spaceIcon('N', '#42ce9f'),
  },
  acme: {
    id: 'acme',
    label: 'Acme Inc.',
    host: 'acme.backlog.jp',
    icon: spaceIcon('A', '#5b8def'),
  },
  beta: { id: 'beta', label: 'ベータ開発', host: 'beta.backlogtool.com', icon: undefined },
} as const;

export type SpaceFixture = (typeof spaces)[keyof typeof spaces];

export const projects = {
  web: { key: 'PROJ', name: 'Webリニューアル', space: spaces.nulab },
  mobile: { key: 'MOB', name: 'モバイルアプリ v3', space: spaces.nulab },
  helpdesk: { key: 'HELP', name: '社内ヘルプデスク', space: spaces.acme },
} as const;

export const people = {
  tanaka: '田中 拓也',
  sato: '佐藤 美咲',
  yamamoto: '山本 遼',
} as const;

export const longSummary =
  '受託案件 請求フロー標準手順（2024 改訂）に基づく請求書テンプレートの差し替え依頼';

export const statuses = {
  open: { label: '未対応', tone: 'neutral' },
  inProgress: { label: '処理中', tone: 'info' },
  resolved: { label: '処理済み', tone: 'success' },
  closed: { label: '完了', tone: 'done' },
} as const;

export const issueTypes = {
  task: { label: 'タスク', tone: 'info' },
  bug: { label: 'バグ', tone: 'danger' },
  request: { label: '要望', tone: 'success' },
} as const;
