import type { Labels } from '@/components/labels';
import type { RowView } from '@/components/types';

import { issueTypes, longSummary, people, projects, spaces, statuses } from './domain';

type IssueInput = {
  key: string;
  title: string;
  project: (typeof projects)[keyof typeof projects];
  assignee?: string;
  status: (typeof statuses)[keyof typeof statuses];
  type?: (typeof issueTypes)[keyof typeof issueTypes];
  crossSpace?: boolean;
  sub?: string;
};

export function issueRow({
  key,
  title,
  project,
  assignee,
  status,
  type = issueTypes.task,
  crossSpace = false,
  sub,
}: IssueInput): RowView {
  return {
    id: `issue:${key}`,
    kind: 'issue',
    code: key,
    title,
    sub: sub ?? [project.name, assignee].filter(Boolean).join(' · '),
    marker: status,
    tag: type,
    space: crossSpace ? { label: project.space.label } : undefined,
    hints: ['enter', 'modEnter', 'complete'],
  };
}

export function pageRow(id: string, title: string, sub?: string): RowView {
  return { id: `page:${id}`, kind: 'page', title, sub, hints: ['enter', 'modEnter', 'complete'] };
}

export function projectRow(project: (typeof projects)[keyof typeof projects]): RowView {
  return {
    id: `project:${project.key}`,
    kind: 'project',
    title: project.name,
    sub: `プロジェクト · ${project.key}`,
    hints: ['enter', 'modEnter', 'stack'],
  };
}

export function spaceRow(space: (typeof spaces)[keyof typeof spaces]): RowView {
  return {
    id: `space:${space.id}`,
    kind: 'space',
    title: space.label,
    sub: space.host,
    hints: ['enter', 'modEnter', 'stack'],
  };
}

export function commandRow(id: string, title: string, target?: string): RowView {
  return {
    id: `command:${id}`,
    kind: 'command',
    title,
    sub: target,
    hints: ['enter', 'complete'],
  };
}

export function descendCommandRow(id: string, title: string): RowView {
  return {
    id: `command:${id}`,
    kind: 'command',
    title,
    hints: ['descend', 'stack'],
  };
}

export function searchRow(query: string, scope: string, labels: Labels, sub?: string): RowView {
  return {
    id: 'search',
    kind: 'search',
    title: labels.rows.searchFor(query),
    sub: sub ?? labels.rows.searchSub(scope),
    tone: 'accent',
    hints: ['enter'],
  };
}

export function searchingRow(labels: Labels): RowView {
  return {
    id: 'searching',
    kind: 'search',
    title: labels.rows.searching,
    busy: true,
    hints: [],
  };
}

export function directJumpRow(key: string, labels: Labels): RowView {
  return {
    id: `direct:${key}`,
    kind: 'issue',
    code: key,
    title: labels.rows.openDirect,
    tone: 'accent',
    hints: ['enter', 'modEnter', 'complete'],
  };
}

export function connectRow(spaceLabel: string | undefined, labels: Labels): RowView {
  return {
    id: spaceLabel === undefined ? 'connect' : `connect:${spaceLabel}`,
    kind: 'connect',
    title:
      spaceLabel === undefined ? labels.rows.connectThis : labels.rows.connectSpace(spaceLabel),
    tone: 'accent',
    hints: ['enter'],
  };
}

export function authExpiredRow(spaceLabel: string, labels: Labels): RowView {
  return {
    id: `status:${spaceLabel}`,
    kind: 'status',
    title: labels.rows.authExpired(spaceLabel),
    tone: 'danger',
    hints: ['enter'],
  };
}

export function noticeRow(count: number, labels: Labels): RowView {
  return {
    id: 'notice',
    kind: 'notice',
    title: labels.rows.pending(count),
    hints: ['enter'],
  };
}

export function hintRow(id: string, title: string): RowView {
  return { id: `hint:${id}`, kind: 'hint', title, hints: [] };
}

export function panelRow(labels: Labels): RowView {
  return {
    id: 'panel',
    kind: 'panel',
    title: labels.rows.toPanel,
    sub: labels.rows.toPanelSub,
    hints: ['enter'],
  };
}

export function externalRow(labels: Labels, url = 'https://nulab.backlog.com/find/PROJ'): RowView {
  return {
    id: 'external',
    kind: 'external',
    title: labels.rows.openExternal,
    sub: url,
    hints: ['enter', 'modEnter'],
  };
}

export function widenRow(scope: string, labels: Labels): RowView {
  return {
    id: `widen:${scope}`,
    kind: 'search',
    title: labels.rows.widenTo(scope),
    tone: 'accent',
    hints: ['enter'],
  };
}

export const sampleIssues = {
  payment: issueRow({
    key: 'PROJ-142',
    title: '決済フローのエラーハンドリングを見直す',
    project: projects.web,
    assignee: people.tanaka,
    status: statuses.inProgress,
  }),
  login: issueRow({
    key: 'PROJ-118',
    title: 'ログイン画面のバリデーションが日本語入力で崩れる',
    project: projects.web,
    assignee: people.sato,
    status: statuses.open,
    type: issueTypes.bug,
  }),
  invoice: issueRow({
    key: 'HELP-23',
    title: longSummary,
    project: projects.helpdesk,
    assignee: people.yamamoto,
    status: statuses.resolved,
    type: issueTypes.request,
  }),
  pushNotice: issueRow({
    key: 'MOB-77',
    title: 'プッシュ通知の受信設定をオンボーディングに組み込む',
    project: projects.mobile,
    status: statuses.open,
  }),
  password: issueRow({
    key: 'PROJ-120',
    title: 'パスワード再設定メールが届かない',
    project: projects.web,
    assignee: people.sato,
    status: statuses.open,
    type: issueTypes.bug,
  }),
  loginRedirect: issueRow({
    key: 'PROJ-99',
    title: 'ログイン後のリダイレクト先を見直す',
    project: projects.web,
    assignee: people.tanaka,
    status: statuses.resolved,
  }),
  release: issueRow({
    key: 'MOB-81',
    title: 'v3.2 リリース手順の棚卸し',
    project: projects.mobile,
    assignee: people.tanaka,
    status: statuses.closed,
  }),
} as const;
