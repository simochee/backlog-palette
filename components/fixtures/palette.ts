import type { Labels } from '@/components/labels';
import type { PaletteView, PathSegmentView, RowView, SectionView } from '@/components/types';

import { projects, spaces } from './domain';
import { deriveFooter } from './footer';
import {
  authExpiredRow,
  connectRow,
  directJumpRow,
  externalRow,
  hintRow,
  noticeRow,
  pageRow,
  panelRow,
  projectRow,
  sampleIssues,
  searchingRow,
  searchRow,
  spaceRow,
  widenRow,
} from './rows';
import { assignedSection, commandsSection, pagesSection, recentSection } from './sections';

export const rootPath = (labels: Labels): PathSegmentView[] => [
  { id: 'root', label: labels.palette.rootScope },
];
export const spacePath: PathSegmentView[] = [
  { id: 'space', label: spaces.nulab.label, badge: true },
];
export const projectPath: PathSegmentView[] = [
  ...spacePath,
  { id: 'project', label: projects.web.name, badge: true },
];

type Partial = {
  path: PathSegmentView[];
  input?: string;
  completion?: string;
  sections: SectionView[];
  selectedId?: string;
  hasResults?: boolean;
  enterLabel?: string;
  armedNotice?: string;
  escLabel?: string;
  toast?: PaletteView['toast'];
};

function view(labels: Labels, partial: Partial): PaletteView {
  const input = partial.input ?? '';
  const selectedId = partial.selectedId ?? partial.sections[0]?.rows[0]?.id;
  return {
    path: partial.path,
    input: { value: input, placeholder: labels.palette.placeholder, completion: partial.completion },
    armedNotice: partial.armedNotice,
    escLabel: partial.escLabel ?? labels.palette.escClose,
    sections: partial.sections,
    selectedId,
    footer: deriveFooter(labels, {
      path: partial.path,
      input,
      sections: partial.sections,
      selectedId,
      hasResults: partial.hasResults,
      enterLabel: partial.enterLabel,
    }),
    toast: partial.toast,
  };
}

const crossSpace = (row: RowView, space: string): RowView => ({ ...row, space: { label: space } });

const resultRows = (labels: Labels): RowView[] => [
  crossSpace(sampleIssues.login, spaces.nulab.label),
  crossSpace(sampleIssues.password, spaces.nulab.label),
  crossSpace(sampleIssues.invoice, spaces.acme.label),
  crossSpace(
    pageRow('login-history', 'ログイン履歴', labels, projects.web, `スペース設定 · ${labels.rows.pageSub}`),
    spaces.nulab.label,
  ),
  {
    id: 'wiki:login-spec',
    kind: 'wiki',
    title: 'ログイン仕様メモ',
    sub: `${projects.web.name} · 最終更新 佐藤 美咲`,
    space: { label: spaces.nulab.label },
    hints: ['enter', 'modEnter', 'complete'],
  },
];

const loginPages = (labels: Labels): SectionView => ({
  id: 'pages',
  label: labels.sections.pages,
  rows: [pageRow('login-history', 'ログイン履歴', labels, projects.web, `スペース設定 · ${labels.rows.pageSub}`)],
});

/** S0 未接続で何も出せない */
export const s0 = (labels: Labels): PaletteView =>
  view(labels, {
    path: [{ id: 'space', label: spaces.beta.label, badge: true }],
    sections: [{ id: 'connect', rows: [connectRow(undefined, labels)] }],
  });

/** S1 空状態（履歴あり） */
export const s1 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    sections: [recentSection(labels), pagesSection(labels), assignedSection(labels)],
  });

/** S1' 空状態（履歴なし） */
export const s1Empty = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    sections: [
      { id: 'hint', rows: [hintRow('type', labels.rows.typeHint)] },
      pagesSection(labels),
    ],
  });

/** S2 ページ名を入力中（がんと） */
export const s2 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    input: 'がんと',
    completion: 'チャート',
    sections: [
      { id: 'pages', label: labels.sections.pages, rows: [pageRow('gantt', 'ガントチャート', labels)] },
      { id: 'search', rows: [searchRow('がんと', projects.web.name, labels)] },
    ],
  });

/** S3 課題キーを入力中（PROJ-12） */
export const s3 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    input: 'PROJ-12',
    sections: [
      { id: 'direct', rows: [directJumpRow('PROJ-12', labels)] },
      { id: 'issues', label: '前方一致する課題', rows: [sampleIssues.password] },
      { id: 'search', rows: [searchRow('PROJ-12', projects.web.name, labels)] },
    ],
  });

/** S4 自由テキスト（ログイン） */
export const s4 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    input: 'ログイン',
    sections: [
      { id: 'search', rows: [searchRow('ログイン', projects.web.name, labels)] },
      loginPages(labels),
    ],
  });

/** S5 検索中 */
export const s5 = (labels: Labels): PaletteView =>
  view(labels, {
    path: spacePath,
    input: 'ログイン',
    selectedId: 'searching',
    sections: [
      {
        id: 'search',
        rows: [
          searchRow('ログイン', spaces.nulab.label, labels, `${spaces.nulab.label} · ${labels.rows.searching}`),
        ],
      },
      {
        id: 'results',
        label: labels.sections.results,
        meta: labels.sections.loading(spaces.nulab.label),
        rows: [searchingRow(labels)],
      },
      loginPages(labels),
    ],
  });

/** S6 検索結果あり（全スペース） */
export const s6 = (labels: Labels): PaletteView => {
  const rows = resultRows(labels);
  return view(labels, {
    path: rootPath(labels),
    input: 'ログイン',
    hasResults: true,
    selectedId: rows[1]?.id,
    sections: [
      { id: 'search', rows: [searchRow('ログイン', labels.palette.rootScope, labels, labels.sections.summary(3, 17))] },
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
      { id: 'search', rows: [searchRow('ろぐいん', projects.web.name, labels, labels.sections.summary(1, 0))] },
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
    path: [...projectPath, { id: 'command', label: labels.rows.switchSpace }],
    escLabel: labels.palette.escBack,
    sections: [
      {
        id: 'args',
        rows: [spaces.nulab, spaces.acme, spaces.beta].map((space) => ({
          ...spaceRow(space),
          hints: ['enter', 'modEnter'],
        })),
      },
    ],
  });

/** S10 未接続スペースがある全スペース検索 */
export const s10 = (labels: Labels): PaletteView => {
  const rows = resultRows(labels);
  return view(labels, {
    path: rootPath(labels),
    input: 'ログイン',
    hasResults: true,
    selectedId: rows[0]?.id,
    sections: [
      { id: 'search', rows: [searchRow('ログイン', labels.palette.rootScope, labels, labels.sections.summary(2, 17))] },
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
  const rows = resultRows(labels).filter((row) => row.space?.label !== spaces.acme.label);
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
    sections: [commandsSection(labels, 'PROJ-142'), recentSection(labels)],
    toast: { message: labels.rows.copied('PROJ-142') },
  });

/** S13 #もば でプロジェクト行を選択中 */
export const s13 = (labels: Labels): PaletteView =>
  view(labels, {
    path: spacePath,
    input: '#もば',
    sections: [{ id: 'projects', label: 'プロジェクト', rows: [projectRow(projects.mobile)] }],
  });
