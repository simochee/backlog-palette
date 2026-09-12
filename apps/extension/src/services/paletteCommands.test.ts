import type { CandidateSection } from '@backlog-palette/core';
import { describe, expect, it } from 'vitest';
import type { RowAction } from '../messaging/ext.ts';
import {
  spaceOrigins,
  switchSpaceStage,
  twoStageCommandEntries,
  twoStageCommandOf,
  withTwoStageHints,
} from './paletteCommands.ts';

const spaces = [
  { spaceKey: 'nulab', displayName: 'ヌーラボ' },
  { spaceKey: 'acme', displayName: 'Acme 社' },
];

const origins: Record<string, string> = {
  nulab: 'https://nulab.backlog.jp',
  acme: 'https://acme.backlog.com',
};

function stage(query: string) {
  return switchSpaceStage({ spaces, originOf: (key) => origins[key], query });
}

function titlesOf(sections: readonly CandidateSection[]): string[] {
  return sections.flatMap((section) => section.rows.map((row) => row.title));
}

describe('スペースを切り替えコマンド', () => {
  it('接続済みスペースが無ければ出さない', () => {
    expect(twoStageCommandEntries([])).toEqual([]);
  });

  it('接続済みスペースがあれば、かなでも英字でも引ける行を出す', () => {
    const [entry] = twoStageCommandEntries(spaces);

    expect(entry?.kind).toBe('command');
    expect(entry?.text).toBe('スペースを切り替え');
    expect(entry?.aliases).toContain('space');
  });

  it('押した先が遷移ではないことを、押す前に予告する', () => {
    const sections: CandidateSection[] = [
      {
        id: 'commands',
        rows: [
          {
            id: 'command:switch-space',
            kind: 'command',
            title: 'スペースを切り替え',
            hint: 'enter',
          },
          { id: 'command:copy-key', kind: 'command', title: '課題キーをコピー', hint: 'enter' },
        ],
      },
    ];

    const [first, second] = withTwoStageHints(sections)[0]?.rows ?? [];

    expect(first?.hint).toBe('more');
    expect(second?.hint).toBe('enter');
  });

  it('遷移する行は 2 段階のコマンドとして扱わない', () => {
    expect(twoStageCommandOf('page:board')).toBeUndefined();
    expect(twoStageCommandOf('command:switch-space')?.label).toBe('スペースを切り替え');
  });
});

describe('コマンドを積んだ先の階層', () => {
  it('接続済みのスペースが並ぶ', () => {
    expect(titlesOf(stage('').sections)).toEqual(['ヌーラボ', 'Acme 社']);
  });

  it('選ぶとそのスペースのダッシュボードへ移動する', () => {
    expect(stage('').actions['space:acme']).toEqual({
      kind: 'navigate',
      url: 'https://acme.backlog.com/dashboard',
      target: 'currentTab',
    });
  });

  it('打った語でスペースを絞り込める', () => {
    expect(titlesOf(stage('acme').sections)).toEqual(['Acme 社']);
  });

  it('遷移先の分からないスペースは出さない', () => {
    const unknown = switchSpaceStage({ spaces, originOf: () => undefined, query: '' });

    expect(unknown.sections).toEqual([]);
  });
});

describe('スペースの遷移先', () => {
  const actions: Record<string, RowAction> = {
    'project:acme:WEB': { kind: 'navigate', url: 'https://acme.backlogtool.com/projects/WEB' },
    'project:nulab:OPS': { kind: 'navigate', url: 'https://nulab.backlog.jp/projects/OPS' },
    'page:board': { kind: 'navigate', url: 'https://nulab.backlog.jp/board/OPS' },
  };

  it('接続情報から組まれた URL をスペースのホストとして使う', () => {
    const found = spaceOrigins(actions, { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab' });

    expect(found.get('acme')).toBe('https://acme.backlogtool.com');
  });

  it('いま見ているスペースはページの origin を使う', () => {
    const found = spaceOrigins(actions, { origin: 'https://nulab.backlog.com', spaceKey: 'nulab' });

    expect(found.get('nulab')).toBe('https://nulab.backlog.com');
  });

  it('接続情報に無いスペースのホストは推測しない', () => {
    const found = spaceOrigins({}, { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab' });

    expect(found.get('acme')).toBeUndefined();
  });
});
