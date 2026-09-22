import type { Labels } from '@/components/labels';
import type { PaletteView, RowView, SectionView } from '@/components/types';

import { projects, type SpaceFixture, spaces } from './domain';
import {
  kindProgress,
  loginPages,
  projectPath,
  resultRows,
  rootPath,
  spacePath,
  view,
} from './palette';
import {
  authExpiredRow,
  connectRow,
  externalRow,
  hintRow,
  noticeRow,
  pageRow,
  panelRow,
  projectRow,
  searchRow,
  spaceRow,
  widenRow,
} from './rows';
import { assignedSection, commandsSection, pagesSection, recentSection } from './sections';

const kindsMeta = (labels: Labels): string => kindProgress(labels, ['12', '3', '2']);

/** コマンド階層の引数行。command の後に space は積めないので stack のヒントを持たない */
const argumentRow = (space: SpaceFixture): RowView => {
  const row = spaceRow(space);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    sub: row.sub,
    space: { label: space.label, icon: space.icon },
    hints: ['enter', 'modEnter'],
  };
};

const withIcon = (space: SpaceFixture): RowView => ({
  ...spaceRow(space),
  space: { label: space.label, icon: space.icon },
});

/** 根のスペース一覧。接続済みは space 行、未接続は connect 行 */
const spacesSection = (labels: Labels): SectionView => ({
  id: 'spaces',
  label: labels.sections.spaces,
  rows: [withIcon(spaces.nulab), withIcon(spaces.acme), connectRow(spaces.beta.label, labels)],
});

const commonPagesSection = (labels: Labels): SectionView => ({
  id: 'common',
  label: labels.sections.commonPages,
  rows: [
    pageRow('personal-settings', labels.rows.personalSettings, labels.rows.commonPageSub),
    pageRow('api-key-settings', labels.rows.apiKeySettings, labels.rows.commonPageSub),
  ],
});

/** S6 検索結果あり */
export const s6 = (labels: Labels): PaletteView => {
  const rows = resultRows();
  return view(labels, {
    path: spacePath,
    input: 'ログイン',
    hasResults: true,
    selectedId: rows[1]?.id,
    sections: [
      {
        id: 'search',
        rows: [searchRow('ログイン', spaces.nulab.label, labels, labels.sections.count(17))],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: kindsMeta(labels),
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
        rows: [searchRow('ろぐいん', projects.web.name, labels, labels.sections.count(0))],
      },
      {
        id: 'results',
        label: labels.sections.results,
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
    armedNotice: labels.palette.armedNotice(projects.web.name),
    sections: [recentSection(labels), pagesSection(labels), assignedSection(labels)],
  });

/** S9 コマンド階層（[space] からスペースを切り替え） */
export const s9 = (labels: Labels): PaletteView =>
  view(labels, {
    path: [...spacePath, { id: 'command', label: labels.rows.switchSpace }],
    placeholder: labels.palette.commandPlaceholder,
    escLabel: labels.palette.escBack,
    sections: [
      {
        id: 'args',
        rows: [spaces.nulab, spaces.acme, spaces.beta].map((space) => argumentRow(space)),
      },
    ],
  });

/** S10 根（スペースを外した後）。検索行は無く、移動先のスペースと共通ページだけ（D-20） */
export const s10 = (labels: Labels): PaletteView => ({
  ...view(labels, {
    path: rootPath,
    sections: [spacesSection(labels), commonPagesSection(labels)],
  }),
  input: { value: '', placeholder: labels.palette.rootPlaceholder },
});

/** S11 認証切れ。結果は返らず、再接続行だけ（I6: パレット全体はエラー画面にしない） */
export const s11 = (labels: Labels): PaletteView =>
  view(labels, {
    path: spacePath,
    input: 'ログイン',
    enterLabel: labels.keys.connect,
    selectedId: `status:${spaces.nulab.label}`,
    sections: [
      {
        id: 'search',
        rows: [
          searchRow(
            'ログイン',
            spaces.nulab.label,
            labels,
            labels.rows.authExpired(spaces.nulab.label),
          ),
        ],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: labels.panel.authExpired,
        rows: [authExpiredRow(spaces.nulab.label, labels)],
      },
      loginPages(labels),
    ],
  });

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
