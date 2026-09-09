import { describe, expect, it } from 'vitest';
import {
  type BuildOptions,
  buildCandidates,
  type CandidateLabels,
  type CandidateSection,
  type IndexEntry,
} from './candidates.ts';

const labels: CandidateLabels = {
  searchInPanel: (term) => `「${term}」をサイドパネルで検索`,
  searchInPanelSub: '課題・Wiki・ドキュメントを横断',
  openIssueDirectly: 'この課題を直接開く',
  openIssueDirectlySub: (projectKey) => `${projectKey} · 課題キーで移動`,
  sectionRecent: '最近',
  sectionPages: 'ページ',
  sectionCommands: 'コマンド',
  sectionPrefixMatch: '前方一致する課題',
};

function entry(overrides: Partial<IndexEntry> & { id: string }): IndexEntry {
  return { kind: 'page', text: overrides.id, context: 'currentSpace', ...overrides };
}

function build(
  input: string,
  index: readonly IndexEntry[],
  overrides: Partial<BuildOptions> = {},
): CandidateSection[] {
  return buildCandidates({
    input,
    index,
    frecencyOf: () => 0,
    labels,
    showSpaceBadges: false,
    ...overrides,
  });
}

function frecency(scores: Record<string, number>): (id: string) => number {
  return (id) => scores[id] ?? 0;
}

function sectionIds(sections: readonly CandidateSection[]): string[] {
  return sections.map((section) => section.id);
}

function rowIds(sections: readonly CandidateSection[]): string[] {
  return sections.flatMap((section) => section.rows.map((row) => row.id));
}

const board = [
  entry({ id: 'page-board', kind: 'page', text: 'ボード', context: 'currentProject' }),
  entry({
    id: 'issue-board',
    kind: 'issue',
    text: 'ボードの表示が崩れる',
    code: 'WEB-42',
    context: 'currentProject',
  }),
  entry({ id: 'command-board', kind: 'command', text: 'ボードを開く' }),
  entry({ id: 'wiki-minutes', kind: 'wiki', text: '議事録', context: 'other' }),
];

describe('入力が空のとき', () => {
  it('候補を組み立てない', () => {
    expect(build('', board)).toEqual([]);
    expect(build('   ', board)).toEqual([]);
  });
});

describe('課題キーを打ったとき', () => {
  const index = [
    entry({ id: 'proj-12', kind: 'issue', text: '決済画面の改修', code: 'PROJ-12' }),
    entry({ id: 'proj-123', kind: 'issue', text: '決済ログの調査', code: 'PROJ-123' }),
    entry({ id: 'other-12', kind: 'issue', text: '別プロジェクトの課題', code: 'OPS-12' }),
  ];

  it('直接開く行が先頭に固定される', () => {
    const [pinned] = build('PROJ-12', index);

    expect(pinned?.rows[0]).toMatchObject({
      kind: 'issue',
      code: 'PROJ-12',
      title: 'この課題を直接開く',
      sub: 'PROJ · 課題キーで移動',
      tone: 'accent',
      hint: 'enter',
      selected: true,
    });
  });

  it('課題キーが前方一致する課題だけが下に並ぶ', () => {
    const sections = build('PROJ-12', index);

    expect(sectionIds(sections)).toEqual(['pinned', 'issuePrefix']);
    expect(sections[1]?.label).toBe('前方一致する課題');
    expect(sections[1]?.rows.map((row) => row.id)).toEqual(['proj-12', 'proj-123']);
  });

  it('直接開く行は、他の候補の frecency がどれだけ高くても先頭から動かない', () => {
    const sections = build('PROJ-12', index, {
      frecencyOf: frecency({ 'proj-123': 1000, 'proj-12': 500 }),
    });

    expect(rowIds(sections)[0]).toBe('openIssue:PROJ-12');
  });

  it('課題キーが完全に一致する課題は、よく開く前方一致の課題より上に出る', () => {
    const sections = build('PROJ-12', index, { frecencyOf: frecency({ 'proj-123': 1000 }) });

    expect(sections[1]?.rows.map((row) => row.id)).toEqual(['proj-12', 'proj-123']);
  });

  it('索引に無い課題キーでも直接開く行は出る', () => {
    const sections = build('ZZZ-9', []);

    expect(sectionIds(sections)).toEqual(['pinned']);
    expect(sections[0]?.rows[0]?.code).toBe('ZZZ-9');
  });
});

describe('数字だけを打ったとき', () => {
  const index = [
    entry({
      id: 'web-1',
      kind: 'issue',
      text: '初期設定',
      code: 'WEB-1',
      context: 'currentProject',
    }),
    entry({
      id: 'web-123',
      kind: 'issue',
      text: '決済の不具合',
      code: 'WEB-123',
      context: 'currentProject',
    }),
  ];

  it('現在プロジェクトの課題キーに補って先頭に固定される', () => {
    const sections = build('123', index);

    expect(sections[0]?.rows[0]).toMatchObject({
      code: 'WEB-123',
      title: 'この課題を直接開く',
      tone: 'accent',
    });
    expect(sections[1]?.rows.map((row) => row.id)).toEqual(['web-123']);
  });

  it('現在プロジェクトが分からないときは直接開く行を出さない', () => {
    const elsewhere = index.map((item) => ({ ...item, context: 'other' }) as const);
    const sections = build('123', elsewhere);

    expect(sections[0]?.rows[0]?.id).toBe('searchInPanel');
  });
});

describe('自由テキストを打ったとき', () => {
  it('サイドパネルで検索が先頭に固定される', () => {
    const [pinned] = build('決済フロー', board);

    expect(pinned?.rows[0]).toMatchObject({
      title: '「決済フロー」をサイドパネルで検索',
      sub: '課題・Wiki・ドキュメントを横断',
      tone: 'accent',
      hint: 'enter',
      selected: true,
    });
  });

  it('かなで打ってもカタカナの索引に一致する', () => {
    expect(rowIds(build('ぼーど', board))).toEqual([
      'searchInPanel',
      'page-board',
      'issue-board',
      'command-board',
    ]);
  });

  it('ページとコマンドは別のセクションに分かれ、コマンドが後に来る', () => {
    const sections = build('ぼーど', board);

    expect(sectionIds(sections)).toEqual(['pinned', 'pages', 'commands']);
    expect(sections[1]?.label).toBe('ページ');
    expect(sections[2]?.label).toBe('コマンド');
  });

  it('一致が 0 件ならサイドパネルで検索だけが残る', () => {
    const sections = build('該当なしの語', board);

    expect(sectionIds(sections)).toEqual(['pinned']);
    expect(rowIds(sections)).toEqual(['searchInPanel']);
  });
});

describe('プレフィックスを付けたとき', () => {
  const index = [
    entry({ id: 'command-status', kind: 'command', text: 'ステータスを変更' }),
    entry({ id: 'user-tanaka', kind: 'user', text: '田中 太郎' }),
    entry({ id: 'project-web', kind: 'project', text: 'Webリニューアル', aliases: ['WEB'] }),
    entry({ id: 'page-status', kind: 'page', text: 'ステータス一覧' }),
  ];

  it('> はコマンドだけに絞る', () => {
    expect(rowIds(build('>ステータス', index))).toEqual(['searchInPanel', 'command-status']);
  });

  it('@ はユーザーだけに絞る', () => {
    expect(rowIds(build('@田中', index))).toEqual(['searchInPanel', 'user-tanaka']);
  });

  it('# はプロジェクトだけに絞る。プロジェクトキーの別名でも一致する', () => {
    expect(rowIds(build('#WEB', index))).toEqual(['searchInPanel', 'project-web']);
  });

  it('全角のプレフィックスも同じように効く', () => {
    expect(rowIds(build('＞ステータス', index))).toEqual(['searchInPanel', 'command-status']);
  });

  it('絞った結果が 0 件でもサイドパネルで検索は残る', () => {
    expect(rowIds(build('>田中', index))).toEqual(['searchInPanel']);
  });

  it('プレフィックスだけならその種別を一覧する', () => {
    expect(rowIds(build('>', index))).toEqual(['command-status']);
  });
});

describe('並びの不変条件', () => {
  it('セクションの順序は固定で、よく使うコマンドでも上のセクションを追い越さない', () => {
    const sections = build('ぼーど', board, { frecencyOf: frecency({ 'command-board': 1000 }) });

    expect(sectionIds(sections)).toEqual(['pinned', 'pages', 'commands']);
    expect(rowIds(sections)).toEqual([
      'searchInPanel',
      'page-board',
      'issue-board',
      'command-board',
    ]);
  });

  it('学習はセクションの中の並びにだけ効く', () => {
    const index = [
      entry({ id: 'board-a', kind: 'page', text: 'ボード会議' }),
      entry({ id: 'board-b', kind: 'page', text: 'ボード議事録' }),
    ];

    expect(rowIds(build('ぼーど', index, { frecencyOf: frecency({ 'board-b': 10 }) }))).toEqual([
      'searchInPanel',
      'board-b',
      'board-a',
    ]);
  });

  it('同じ入力なら索引の並び順が変わっても同じ結果になる', () => {
    const shuffled = [...board].reverse();

    expect(rowIds(build('ぼーど', shuffled))).toEqual(rowIds(build('ぼーど', board)));
  });
});

describe('行数の上限', () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    entry({ id: `page-${i + 1}`, kind: 'page', text: `ページ${i + 1}` }),
  );

  it('既定では 1 セクション 5 行までで、打ち切った最後の行が続きの入口になる', () => {
    const sections = build('ページ', many);
    const rows = sections[1]?.rows ?? [];

    expect(rows).toHaveLength(5);
    expect(rows[4]?.hint).toBe('more');
    expect(rows[3]?.hint).toBe('enter');
  });

  it('全体の上限で落ちたセクションがあれば、残った末尾の行が続きの入口になる', () => {
    const withCommand = [
      ...many,
      entry({ id: 'command-page', kind: 'command', text: 'ページを作る' }),
    ];
    const sections = build('ページ', withCommand, { limits: { perSection: 2, total: 3 } });

    expect(sectionIds(sections)).toEqual(['pinned', 'pages']);
    expect(rowIds(sections)).toEqual(['searchInPanel', 'page-1', 'page-2']);
    expect(sections[1]?.rows[1]?.hint).toBe('more');
  });

  it('すべて収まるときは続きの入口を出さない', () => {
    const sections = build('ページ', many.slice(0, 3));

    expect(sections.flatMap((section) => section.rows).every((row) => row.hint === 'enter')).toBe(
      true,
    );
  });
});

describe('行の見た目', () => {
  it('選択状態になるのは先頭の行だけ', () => {
    const rows = build('ぼーど', board).flatMap((section) => section.rows);

    expect(rows[0]?.selected).toBe(true);
    expect(rows.slice(1).every((row) => row.selected === undefined)).toBe(true);
  });

  it('全スペース表示のときだけ出自バッジを付ける', () => {
    const index = [entry({ id: 'page-board', kind: 'page', text: 'ボード', spaceKey: 'acme' })];

    expect(build('ぼーど', index, { showSpaceBadges: true })[1]?.rows[0]?.avatar).toEqual({
      label: 'acme',
    });
    expect(build('ぼーど', index)[1]?.rows[0]?.avatar).toBeUndefined();
  });
});
