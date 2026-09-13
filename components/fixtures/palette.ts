import type { Labels } from '@/components/labels';
import type { PaletteView, PathSegmentView, RowView, SectionView } from '@/components/types';

import { projects, type SpaceFixture, spaces } from './domain';
import { deriveFooter } from './footer';
import {
  connectRow,
  directJumpRow,
  hintRow,
  pageRow,
  sampleIssues,
  searchingRow,
  searchRow,
} from './rows';
import { assignedSection, pagesSection, recentSection } from './sections';

export const rootPath = (labels: Labels): PathSegmentView[] => [
  { id: 'root', label: labels.palette.rootScope },
];
export const spaceSegment = (space: SpaceFixture): PathSegmentView => ({
  id: `space:${space.id}`,
  label: space.label,
  badge: true,
  icon: space.icon,
});
export const spacePath: PathSegmentView[] = [spaceSegment(spaces.nulab)];
export const projectPath: PathSegmentView[] = [
  ...spacePath,
  { id: 'project', label: projects.web.name, badge: true },
];

export type StatePartial = {
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

export function view(labels: Labels, partial: StatePartial): PaletteView {
  const input = partial.input ?? '';
  const selectedId = partial.selectedId ?? partial.sections[0]?.rows[0]?.id;
  return {
    path: partial.path,
    input: {
      value: input,
      placeholder: labels.palette.placeholder,
      completion: partial.completion,
    },
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

export const crossSpace = (row: RowView, space: SpaceFixture): RowView => ({
  ...row,
  space: { label: space.label, icon: space.icon },
});

export const resultRows = (): RowView[] => [
  crossSpace(sampleIssues.login, spaces.nulab),
  crossSpace(sampleIssues.password, spaces.nulab),
  crossSpace(sampleIssues.invoice, spaces.acme),
  {
    id: 'document:login-flow',
    kind: 'document',
    title: 'ログインフロー改修 要件',
    sub: `${projects.web.name} · 最終更新 山本 遼`,
    space: { label: spaces.nulab.label, icon: spaces.nulab.icon },
    hints: ['enter', 'modEnter', 'complete'],
  },
  {
    id: 'wiki:login-spec',
    kind: 'wiki',
    title: 'ログイン仕様メモ',
    sub: `${projects.web.name} · 最終更新 佐藤 美咲`,
    space: { label: spaces.nulab.label, icon: spaces.nulab.icon },
    hints: ['enter', 'modEnter', 'complete'],
  },
];

/** 「ログイン」に前方一致するページは無い。表示キャッシュにある課題が弱い一致として並ぶ */
export const loginPages = (labels: Labels): SectionView => ({
  id: 'pages',
  label: labels.sections.pages,
  rows: [sampleIssues.login],
});

/** S0 未接続で何も出せない */
export const s0 = (labels: Labels): PaletteView =>
  view(labels, {
    path: [spaceSegment(spaces.beta)],
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
    sections: [{ id: 'hint', rows: [hintRow('type', labels.rows.typeHint)] }, pagesSection(labels)],
  });

/** S2 ページ名を入力中（がんと） */
export const s2 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    input: 'がんと',
    completion: 'チャート',
    sections: [
      {
        id: 'pages',
        label: labels.sections.pages,
        rows: [pageRow('gantt', 'ガントチャート', labels)],
      },
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
          searchRow(
            'ログイン',
            spaces.nulab.label,
            labels,
            `${spaces.nulab.label} · ${labels.rows.searching}`,
          ),
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
