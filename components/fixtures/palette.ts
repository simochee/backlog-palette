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
import {
  assignedFailedSection,
  assignedLoadingSection,
  assignedSection,
  pagesSection,
  recentSection,
  thisIssueSection,
} from './sections';

/** 根はスペースを積んでいない状態。検索はせず、移動先のスペースと共通ページだけ（D-20） */
export const rootPath: PathSegmentView[] = [];
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

/**
 * 検索結果の見出しの補足。単位はスペースではなく種別（D-20・§7.2）。
 * 値は件数か「読み込み中」で、3 種別ぶんを「·」で並べる
 */
export const kindProgress = (labels: Labels, values: readonly [string, string, string]): string =>
  [labels.panel.options.issue, labels.panel.options.wiki, labels.panel.options.document]
    .map((kind, index) => `${kind} ${values[index]}`)
    .join(' · ');

const loadingMeta = (labels: Labels): string =>
  kindProgress(labels, [labels.panel.loading, labels.panel.loading, labels.panel.loading]);

export type StatePartial = {
  path: PathSegmentView[];
  input?: string;
  completion?: string;
  sections: SectionView[];
  placeholder?: string;
  selectedId?: string;
  hasResults?: boolean;
  enterLabel?: string;
  armedNotice?: string;
  escLabel?: string;
  toast?: PaletteView['toast'];
};

export function view(labels: Labels, partial: StatePartial): PaletteView {
  const input = partial.input ?? '';
  const rows = partial.sections.flatMap((section) => section.rows);
  // 既定の選択は動作を持つ最初の行。案内行や取得中の行は選択を通さない（D-35）
  const selectedId = partial.selectedId ?? rows.find((row) => row.hints.length > 0)?.id;
  return {
    path: partial.path,
    input: {
      value: input,
      placeholder: partial.placeholder ?? labels.palette.placeholder,
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

export const resultRows = (): RowView[] => [
  sampleIssues.login,
  sampleIssues.password,
  {
    id: 'document:login-flow',
    kind: 'document',
    title: 'ログインフロー改修 要件',
    sub: `${projects.web.name} · 最終更新 山本 遼`,
    hints: ['enter', 'modEnter', 'complete'],
  },
  {
    id: 'wiki:login-spec',
    kind: 'wiki',
    title: 'ログイン仕様メモ',
    sub: `${projects.web.name} · 最終更新 佐藤 美咲`,
    hints: ['enter', 'modEnter', 'complete'],
  },
];

/** 「ログイン」に前方一致するページは無い。表示キャッシュにある課題が弱い一致として並ぶ */
/**
 * 「ログイン」の候補。検索結果に出た対象は候補から落とすので、ここに並ぶのは
 * 結果に含まれなかった表示キャッシュ由来の課題（D-3: 候補は結果の下に残る）
 */
export const loginPages = (labels: Labels): SectionView => ({
  id: 'pages',
  label: labels.sections.pages,
  rows: [{ ...sampleIssues.loginRedirect, id: `cache:${sampleIssues.loginRedirect.id}` }],
});

/** S0 未接続で何も出せない */
export const s0 = (labels: Labels): PaletteView =>
  view(labels, {
    path: [spaceSegment(spaces.beta)],
    sections: [{ id: 'connect', rows: [connectRow(undefined, labels)] }],
  });

/** S1 空状態（履歴あり）。課題ページから開いたので「この課題」が 2 段目に入る */
export const s1 = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    sections: [
      recentSection(labels),
      thisIssueSection(labels, 'PROJ-142'),
      pagesSection(labels),
      assignedSection(labels),
    ],
  });

/** S1'' 担当課題が届く前。見出しと読み込み中の行が先に出る（D-38） */
export const s1Loading = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    sections: [recentSection(labels), pagesSection(labels), assignedLoadingSection(labels)],
  });

/** S1''' 担当課題の取得に失敗。読み込み中のままにせず理由を行にする（I6・D-38） */
export const s1Failed = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    sections: [
      recentSection(labels),
      pagesSection(labels),
      assignedFailedSection(labels, spaces.nulab.label),
    ],
  });

/** S1' 空状態（履歴なし） */
export const s1Empty = (labels: Labels): PaletteView =>
  view(labels, {
    path: projectPath,
    sections: [pagesSection(labels), { id: 'hint', rows: [hintRow('type', labels.rows.typeHint)] }],
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
        rows: [pageRow('gantt', 'ガントチャート')],
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
      { id: 'issues', label: labels.sections.issues('PROJ-12'), rows: [sampleIssues.password] },
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
        meta: loadingMeta(labels),
        rows: [searchingRow(labels)],
      },
      loginPages(labels),
    ],
  });
