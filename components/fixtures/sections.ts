import type { Labels } from '@/components/labels';
import type { SectionView } from '@/components/types';

import { projects } from './domain';
import { commandRow, descendCommandRow, pageRow, projectRow, sampleIssues } from './rows';

export function recentSection(labels: Labels): SectionView {
  return {
    id: 'recent',
    label: labels.sections.recent,
    meta: labels.sections.learned,
    rows: [
      { ...sampleIssues.payment, sub: `${projects.web.name} · ${labels.rows.recentSub}` },
      pageRow('board', 'ボード', labels, projects.web, `${projects.web.name} · ${labels.rows.recentSub}`),
      { ...sampleIssues.pushNotice, sub: `${projects.mobile.name} · ${labels.rows.recentSub}` },
      { ...projectRow(projects.helpdesk), sub: `プロジェクト · HELP · ${labels.rows.recentSub}` },
    ],
  };
}

export function pagesSection(labels: Labels): SectionView {
  return {
    id: 'pages',
    label: labels.sections.pagesOf(projects.web.name),
    rows: [
      pageRow('issues', '課題一覧', labels),
      pageRow('board', 'ボード', labels),
      pageRow('gantt', 'ガントチャート', labels),
      pageRow('wiki', 'Wiki', labels),
      pageRow('add-issue', '課題の追加', labels),
    ],
  };
}

export function assignedSection(labels: Labels): SectionView {
  return {
    id: 'assigned',
    label: labels.sections.assigned,
    meta: labels.sections.count(3),
    rows: [sampleIssues.login, sampleIssues.release, sampleIssues.invoice],
  };
}

export function commandsSection(labels: Labels, issueKey?: string): SectionView {
  const copy =
    issueKey === undefined
      ? []
      : [
        commandRow('copy-key', labels.rows.copyIssueKey, issueKey),
        commandRow('copy-url', labels.rows.copyIssueUrl, issueKey),
        commandRow('copy-title', labels.rows.copyIssueTitle, issueKey),
        commandRow('copy-md', labels.rows.copyIssueMarkdown, issueKey),
      ];
  return {
    id: 'commands',
    label: labels.sections.commands,
    rows: [...copy, descendCommandRow('switch-space', labels.rows.switchSpace)],
  };
}
