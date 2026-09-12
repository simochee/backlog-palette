import type { CandidateSection, IndexEntry } from '@backlog-palette/core';
import { describe, expect, it } from 'vitest';
import { CANDIDATE_LABELS } from './candidateLabels.ts';
import {
  candidatesFor,
  footerHints,
  initialState,
  type PaletteEvent,
  type PaletteState,
  pathOf,
  reduce,
} from './paletteStack.ts';

const START = { start: 0, end: 0 };
const IN_TEXT = { start: 3, end: 3 };

const onIssuePage = initialState({ spaceKey: 'nulab', projectKey: 'WEB' });

function afterEvents(state: PaletteState, ...events: readonly PaletteEvent[]): PaletteState {
  return events.reduce((current, event) => reduce(current, event).state, state);
}

function labelsOf(state: PaletteState): string[] {
  return pathOf(state.stack).map((segment) => segment.label);
}

const index: IndexEntry[] = [
  { id: 'page-board', kind: 'page', text: 'ボード', context: 'currentProject' },
  { id: 'wiki-board', kind: 'wiki', text: 'ボードの使い方', context: 'currentSpace' },
  {
    id: 'project-board',
    kind: 'project',
    text: 'ボード改善',
    context: 'currentSpace',
    spaceKey: 'acme',
  },
];

function candidates(state: PaletteState, commands: readonly IndexEntry[] = []): CandidateSection[] {
  return candidatesFor({
    state,
    base: { spaceKey: 'nulab', projectKey: 'WEB' },
    index,
    commands,
    frecencyOf: () => 0,
    labels: CANDIDATE_LABELS,
  });
}

function rowIdsOf(sections: readonly CandidateSection[]): string[] {
  return sections.flatMap((section) => section.rows.map((row) => row.id));
}

describe('パレットを開いたとき', () => {
  it('いま見ているページのスペースとプロジェクトが積まれている', () => {
    expect(labelsOf(onIssuePage)).toEqual(['nulab', 'WEB']);
  });

  it('プロジェクトの外ならスペースだけを積む', () => {
    expect(labelsOf(initialState({ spaceKey: 'nulab' }))).toEqual(['nulab']);
  });

  it('スペースが分からないページでは全スペースから始まる', () => {
    expect(labelsOf(initialState({}))).toEqual(['全スペース']);
  });
});

describe('⌫ でスコープを外す', () => {
  it('キャレットが先頭にあるときだけスタックに効く', () => {
    const typed = afterEvents(onIssuePage, { type: 'query', value: 'ボー' });

    expect(afterEvents(typed, { type: 'backspace', caret: IN_TEXT })).toBe(typed);
    expect(afterEvents(typed, { type: 'backspace', caret: START }).stack.armedForDelete).toBe(true);
  });

  it('1 回目は削除待ちになるだけで、スタックは変わらない', () => {
    const armed = afterEvents(onIssuePage, { type: 'backspace', caret: START });

    expect(labelsOf(armed)).toEqual(['nulab', 'WEB']);
    expect(armed.stack.armedForDelete).toBe(true);
  });

  it('削除待ちの段には取り消し線が付く', () => {
    const armed = afterEvents(onIssuePage, { type: 'backspace', caret: START });

    expect(pathOf(armed.stack).map((segment) => segment.armed)).toEqual([false, true]);
  });

  it('2 回目で右端が 1 段外れる', () => {
    const popped = afterEvents(
      onIssuePage,
      { type: 'backspace', caret: START },
      { type: 'backspace', caret: START },
    );

    expect(labelsOf(popped)).toEqual(['nulab']);
    expect(popped.stack.armedForDelete).toBe(false);
  });

  it('入力すると削除待ちが解除される', () => {
    const retyped = afterEvents(
      onIssuePage,
      { type: 'backspace', caret: START },
      { type: 'query', value: 'ぼ' },
      { type: 'backspace', caret: START },
    );

    expect(labelsOf(retyped)).toEqual(['nulab', 'WEB']);
  });

  it('根まで戻ると全スペースの 1 段だけが残る', () => {
    const root = afterEvents(
      onIssuePage,
      ...Array.from({ length: 4 }, () => ({ type: 'backspace', caret: START }) as const),
    );

    expect(labelsOf(root)).toEqual(['全スペース']);
  });

  it('全スペースから先へは戻らない', () => {
    const root = initialState({});

    expect(afterEvents(root, { type: 'backspace', caret: START })).toEqual(root);
  });
});

describe('Esc で 1 階層戻る', () => {
  const pushed = afterEvents(onIssuePage, {
    type: 'command',
    commandId: 'switch-space',
    label: 'スペースを切り替え',
  });

  it('コマンドを積んでいれば 1 段戻す', () => {
    const step = reduce(pushed, { type: 'escape' });

    expect(step.close).toBe(false);
    expect(labelsOf(step.state)).toEqual(['nulab', 'WEB']);
  });

  it('コマンドを積んでいなければ閉じる合図を返す', () => {
    const step = reduce(onIssuePage, { type: 'escape' });

    expect(step.close).toBe(true);
    expect(labelsOf(step.state)).toEqual(['nulab', 'WEB']);
  });

  it('スコープだけを戻したときも閉じる合図になる', () => {
    const root = initialState({});

    expect(reduce(root, { type: 'escape' }).close).toBe(true);
  });

  it('コマンドから戻ると、その階層で打った入力は残らない', () => {
    const typed = afterEvents(pushed, { type: 'query', value: 'acme' });

    expect(reduce(typed, { type: 'escape' }).state.query).toBe('');
  });
});

describe('コマンドを積んだとき', () => {
  const typed = afterEvents(onIssuePage, { type: 'query', value: 'すぺーす' });
  const pushed = afterEvents(typed, {
    type: 'command',
    commandId: 'switch-space',
    label: 'スペースを切り替え',
  });

  it('入力が空になる', () => {
    expect(pushed.query).toBe('');
  });

  it('パスの右端にコマンドが並ぶ', () => {
    expect(labelsOf(pushed)).toEqual(['nulab', 'WEB', 'スペースを切り替え']);
  });

  it('コマンドの段には出自バッジを付けない', () => {
    expect(pathOf(pushed.stack).map((segment) => segment.avatar)).toEqual([true, true, false]);
  });

  it('⌫ でもコマンドの段から戻れる', () => {
    const popped = afterEvents(
      pushed,
      { type: 'backspace', caret: START },
      { type: 'backspace', caret: START },
    );

    expect(labelsOf(popped)).toEqual(['nulab', 'WEB']);
  });
});

describe('スコープと候補', () => {
  const typed = { type: 'query', value: 'ぼーど' } as const;
  const back = { type: 'backspace', caret: START } as const;

  it('スコープの外にある索引の行は候補に出ない', () => {
    const inProject = afterEvents(onIssuePage, typed);

    expect(rowIdsOf(candidates(inProject))).toContain('page-board');
    expect(rowIdsOf(candidates(inProject))).not.toContain('wiki-board');
  });

  it('プロジェクトを外すと、スペース全体の行まで候補に入る', () => {
    const inSpace = afterEvents(onIssuePage, back, back, typed);

    expect(rowIdsOf(candidates(inSpace))).toContain('wiki-board');
    expect(rowIdsOf(candidates(inSpace))).not.toContain('project-board');
  });

  it('スタックが全スペースまで戻ると、他スペースの行も候補に出る', () => {
    const allSpaces = afterEvents(onIssuePage, back, back, back, back, typed);

    expect(rowIdsOf(candidates(allSpaces))).toContain('project-board');
  });

  it('スタックが全スペースまで戻ると、候補にスペースバッジが付く', () => {
    const allSpaces = afterEvents(onIssuePage, back, back, back, back, typed);
    const rows = candidates(allSpaces).flatMap((section) => section.rows);

    expect(rows.find((row) => row.id === 'project-board')?.avatar).toEqual({ label: 'acme' });
  });

  it('コマンドはどの階層にいても候補に残る', () => {
    const command: IndexEntry = {
      id: 'command:switch-space',
      kind: 'command',
      text: 'スペースを切り替え',
      context: 'currentSpace',
    };
    const inProject = afterEvents(onIssuePage, { type: 'query', value: 'すぺーす' });

    expect(rowIdsOf(candidates(inProject, [command]))).toContain('command:switch-space');
  });
});

describe('フッターのキーヒント', () => {
  function labels(state: PaletteState): string[] {
    return footerHints(state).map((hint) => hint.label);
  }

  it('ふだんは右端から 1 段戻せることを示す', () => {
    expect(labels(onIssuePage)).toContain('右端から 1 段戻す');
  });

  it('削除待ちのときは、もう一度押すと消えることを示す', () => {
    const armed = afterEvents(onIssuePage, { type: 'backspace', caret: START });

    expect(labels(armed)).toContain('右端を 1 段削除');
  });

  it('コマンド階層では Esc が 1 つ前に戻ることを示す', () => {
    const pushed = afterEvents(onIssuePage, {
      type: 'command',
      commandId: 'switch-space',
      label: 'スペースを切り替え',
    });

    expect(labels(pushed)).toContain('1 つ前に戻る');
  });
});
