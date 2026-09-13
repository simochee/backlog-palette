import type { Labels } from '@/components/labels';
import type { PaletteView, RowView } from '@/components/types';

import { projects, spaces } from './domain';
import { loginPages, projectPath, resultRows, rootPath, spacePath, view } from './palette';
import {
  authExpiredRow,
  connectRow,
  externalRow,
  hintRow,
  noticeRow,
  panelRow,
  projectRow,
  searchRow,
  spaceRow,
  widenRow,
} from './rows';
import { assignedSection, commandsSection, pagesSection, recentSection } from './sections';

/** コマンド階層の引数行。command の後に space は積めないので stack のヒントを持たない */
const argumentRow = (space: (typeof spaces)[keyof typeof spaces]): RowView => {
  const row = spaceRow(space);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    sub: row.sub,
    hints: ['enter', 'modEnter'],
  };
};

/** S6 検索結果あり（全スペース） */
export const s6 = (labels: Labels): PaletteView => {
  const rows = resultRows();
  return view(labels, {
    path: rootPath(labels),
    input: 'ログイン',
    hasResults: true,
    selectedId: rows[1]?.id,
    sections: [
      {
        id: 'search',
        rows: [
          searchRow('ログイン', labels.palette.rootScope, labels, labels.sections.summary(3, 17)),
        ],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: labels.sections.summary(3, 17),
        rows: [noticeRow(2, labels), ...rows, externalRow(labels)],
      },
      loginPages(labels),
    ],
  });
};

/** S7 検索 0 件 */
export const s7 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    input: 'ろぐいん',
    hasResults: true,
    selectedId: `widen:${spaces.nulab.label}`,
    enterLabel: labels.keys.search,
    sections: [
      {
        id: 'search',
        rows: [searchRow('ろぐいん', projects.web.name, labels, labels.sections.summary(1, 0))],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: labels.sections.summary(1, 0),
        rows: [
          hintRow('no-results', labels.rows.noResults),
          widenRow(spaces.nulab.label, labels),
          panelRow(labels),
          externalRow(labels),
        ],
      },
    ],
  });

/** S8 スコープ削除待ち */
export const s8 = (labels: Labels): PaletteView =>
  view(labels, {
    path: [...spacePath, { id: 'project', label: projects.web.name, badge: true, armed: true }],
    armedNotice: labels.palette.armedNotice,
    sections: [recentSection(labels), pagesSection(labels), assignedSection(labels)],
  });

/** S9 コマンド階層（スペースを切り替え） */
export const s9 = (labels: Labels): PaletteView =>
  view(labels, {
    path: [...spacePath, { id: 'command', label: labels.rows.switchSpace }],
    escLabel: labels.palette.escBack,
    sections: [
      {
        id: 'args',
        rows: [spaces.nulab, spaces.acme, spaces.beta].map((space) => argumentRow(space)),
      },
    ],
  });

/** S10 未接続スペースがある全スペース検索 */
export const s10 = (labels: Labels): PaletteView => {
  const rows = resultRows();
  return view(labels, {
    path: rootPath(labels),
    input: 'ログイン',
    hasResults: true,
    selectedId: rows[0]?.id,
    sections: [
      {
        id: 'search',
        rows: [
          searchRow('ログイン', labels.palette.rootScope, labels, labels.sections.summary(2, 17)),
        ],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: labels.sections.summary(2, 17),
        rows: [...rows, connectRow(spaces.beta.label, labels)],
      },
      loginPages(labels),
    ],
  });
};

/** S11 一部スペースが認証切れ */
export const s11 = (labels: Labels): PaletteView => {
  const rows = resultRows().filter((row) => row.space?.label !== spaces.acme.label);
  return view(labels, {
    path: rootPath(labels),
    input: 'ログイン',
    hasResults: true,
    selectedId: rows[0]?.id,
    sections: [
      {
        id: 'search',
        rows: [
          searchRow(
            'ログイン',
            labels.palette.rootScope,
            labels,
            `${labels.sections.countOf(spaces.nulab.label, 12)} · ${spaces.acme.label} 認証切れ`,
          ),
        ],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: `${labels.sections.countOf(spaces.nulab.label, 12)} · ${spaces.acme.label} 認証切れ`,
        rows: [...rows, authExpiredRow(spaces.acme.label, labels)],
      },
      loginPages(labels),
    ],
  });
};

/** S12 コピー直後 */
export const s12 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    selectedId: 'command:copy-key',
    sections: [commandsSection(labels, { issueKey: 'PROJ-142' }), recentSection(labels)],
    toast: { message: labels.rows.copied('PROJ-142') },
  });

/** S13 #もば でプロジェクト行を選択中 */
export const s13 = (labels: Labels): PaletteView =>
  view(labels, {
    path: spacePath,
    input: '#もば',
    sections: [{ id: 'projects', label: 'プロジェクト', rows: [projectRow(projects.mobile)] }],
  });
