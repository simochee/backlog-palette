import type { Labels } from '@/components/labels';
import type { RowView, SectionView } from '@/components/types';

import { projects } from './domain';
import { commandRow, descendCommandRow, pageRow, projectRow, sampleIssues } from './rows';

/** 同じ対象がページやコマンドのセクションにも並ぶので、行 id はセクション内で一意にする */
const recent = (row: RowView): RowView => ({ ...row, id: `recent:${row.id}` });

/**
 * 最近開いたに入るのは課題・Wiki・ドキュメント・プロジェクトだけで、ページ定義は入らない
 * （§9。ページは次のセクションが担当する）。補足は行が元から持つものをそのまま使う
 */
export function recentSection(labels: Labels): SectionView {
  return {
    id: 'recent',
    label: labels.sections.recent,
    meta: labels.sections.learned,
    rows: [
      recent(sampleIssues.payment),
      recent(sampleIssues.pushNotice),
      recent(projectRow(projects.helpdesk)),
    ],
  };
}

export function pagesSection(labels: Labels): SectionView {
  return {
    id: 'pages',
    label: labels.sections.pagesOf(projects.web.name),
    rows: [
      pageRow('issues', '課題一覧'),
      pageRow('board', 'ボード'),
      pageRow('gantt', 'ガントチャート'),
      pageRow('wiki', 'Wiki'),
      pageRow('files', 'ファイル'),
    ],
  };
}

/** 課題ページのときだけ出る「この課題」。2 段階コマンド 1 行（§9・D-46） */
export function thisIssueSection(labels: Labels, issueKey: string): SectionView {
  return {
    id: 'issue',
    label: labels.sections.thisIssue,
    rows: [descendCommandRow('copy-issue', labels.rows.copyIssue(issueKey))],
  };
}

/** 担当課題の取得中。動作を持たないので選択は止まらない（D-35・D-38） */
export function assignedLoadingSection(labels: Labels): SectionView {
  return {
    id: 'assigned',
    label: labels.sections.assigned,
    rows: [
      { id: 'assigned:loading', kind: 'hint', title: labels.rows.loading, busy: true, hints: [] },
    ],
  };
}

/** 担当課題の取得に失敗。認証切れだけ再接続へ運べる（I6・D-38） */
export function assignedFailedSection(labels: Labels, spaceLabel: string): SectionView {
  return {
    id: 'assigned',
    label: labels.sections.assigned,
    rows: [
      {
        id: 'assigned:status',
        kind: 'status',
        title: labels.rows.authExpired(spaceLabel),
        tone: 'danger',
        hints: ['enter'],
      },
    ],
  };
}

/** 期限が出るのは期限切れと 7 日以内だけ（D-50）。3 行のうち 2 行は出ない */
export function assignedSection(labels: Labels): SectionView {
  return {
    id: 'assigned',
    label: labels.sections.assigned,
    meta: labels.sections.count(3),
    rows: [
      { ...sampleIssues.login, due: { label: labels.rows.overdue, tone: 'danger' } },
      { ...sampleIssues.pushNotice, due: { label: labels.rows.dueOn(9, 25), tone: 'warning' } },
      sampleIssues.invoice,
    ],
  };
}

type CommandsOptions = {
  issueKey?: string;
  /** 「スペースを切り替え」はスコープが [space] のときだけ（palette.md §4） */
  atSpaceScope?: boolean;
};

export function commandsSection(labels: Labels, options: CommandsOptions = {}): SectionView {
  const copy =
    options.issueKey === undefined
      ? []
      : [
          commandRow('copy-key', labels.rows.copyIssueKey, options.issueKey),
          commandRow('copy-url', labels.rows.copyIssueUrl, options.issueKey),
          commandRow('copy-title', labels.rows.copyIssueTitle, options.issueKey),
          commandRow('copy-md', labels.rows.copyIssueMarkdown, options.issueKey),
        ];
  const switchSpace =
    options.atSpaceScope === true
      ? [descendCommandRow('switch-space', labels.rows.switchSpace)]
      : [];
  return { id: 'commands', label: labels.sections.commands, rows: [...copy, ...switchSpace] };
}
