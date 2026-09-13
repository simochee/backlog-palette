/**
 * 日本語の現実的なダミー。目的は長さと記号の混在を再現すること（ui-components.md §4）。
 */
export const spaces = {
  nulab: { id: 'nulab', label: 'nulab', host: 'nulab.backlog.com' },
  acme: { id: 'acme', label: 'acme', host: 'acme.backlog.jp' },
  beta: { id: 'beta', label: 'beta', host: 'beta.backlogtool.com' },
} as const;

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
