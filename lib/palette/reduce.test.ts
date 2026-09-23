import { describe, expect, it } from 'vitest';

import { stackOf } from '@/lib/stack/stack';

import { reduce } from './reduce';
import { initialState, type PaletteState } from './state';
import { createPaletteStore } from './store';

const space = { kind: 'space', spaceId: 'nulab', label: 'ヌーラボ' } as const;
const project = { kind: 'project', projectId: '1', projectKey: 'PROJ', label: 'Web' } as const;
const command = {
  kind: 'command',
  commandId: 'switch-space',
  label: 'スペースを切り替え',
} as const;

const opened: PaletteState = {
  ...initialState,
  stack: stackOf(space, project),
  input: 'ろぐ',
  selectedId: 'pages:page:board',
  toast: { message: 'x' },
};

describe('開閉と入力', () => {
  it('開くと前回の入力と選択とスタックは残らない', () => {
    const state = reduce(opened, { type: 'opened' });
    expect(state.input).toBe('');
    expect(state.selectedId).toBeUndefined();
    expect(state.toast).toBeUndefined();
    expect(state.stack.segments).toHaveLength(0);
  });

  it('開いたページのスタックが届くと、それまでに打った入力を残したままスタックが置かれる', () => {
    const typed = reduce(reduce(opened, { type: 'opened' }), {
      type: 'inputChanged',
      value: 'ぼーど',
    });
    const state = reduce(typed, { type: 'located', stack: stackOf(space) });
    expect(state.input).toBe('ぼーど');
    expect(state.selectedId).toBeUndefined();
    expect(state.stack.segments).toHaveLength(1);
  });

  it('入力が変わると選択は先頭へ戻り、削除待ちとトーストは解除される', () => {
    const armed = { ...opened, stack: { ...opened.stack, armedForDelete: true } };
    const state = reduce(armed, { type: 'inputChanged', value: 'ろぐい' });
    expect(state.input).toBe('ろぐい');
    expect(state.selectedId).toBeUndefined();
    expect(state.stack.armedForDelete).toBe(false);
    expect(state.toast).toBeUndefined();
  });

  it('↑↓ は選択行の id を置き換える', () => {
    expect(reduce(opened, { type: 'selected', id: 'a' }).selectedId).toBe('a');
  });
});

describe('⇥ で取り込む（D-4）', () => {
  it('space を積むと入力は空になり選択は先頭へ', () => {
    const state = reduce(opened, { type: 'took', target: { kind: 'space', space } });
    expect(state.stack.segments.map((s) => s.kind)).toEqual(['space']);
    expect(state.input).toBe('');
    expect(state.selectedId).toBeUndefined();
  });

  it('project を積むと [space / project] になる', () => {
    const state = reduce(
      { ...opened, stack: stackOf(space) },
      { type: 'took', target: { kind: 'project', space, project } },
    );
    expect(state.stack.segments.map((s) => s.kind)).toEqual(['space', 'project']);
  });

  it('補完は入力をタイトルで置き換え、スタックは変えない', () => {
    const state = reduce(opened, { type: 'took', target: { kind: 'complete', text: 'ボード' } });
    expect(state.input).toBe('ボード');
    expect(state.stack.segments).toEqual(opened.stack.segments);
  });

  it('2 段階コマンドの ↵ は command を積んで入力を空にする', () => {
    const state = reduce({ ...opened, stack: stackOf(space) }, { type: 'descended', command });
    expect(state.stack.segments.at(-1)?.kind).toBe('command');
    expect(state.input).toBe('');
  });
});

describe('⌫ と Esc', () => {
  it('⌫ の 1 回目は削除待ちになるだけで、入力と選択は動かない', () => {
    const state = reduce(opened, { type: 'backspacedAtStart' });
    expect(state.stack.armedForDelete).toBe(true);
    expect(state.input).toBe('ろぐ');
    expect(state.selectedId).toBe(opened.selectedId);
  });

  it('⌫ の 2 回目で段が外れ、候補が入れ替わるので選択は先頭へ。入力文字は消えない', () => {
    const state = reduce(reduce(opened, { type: 'backspacedAtStart' }), {
      type: 'backspacedAtStart',
    });
    expect(state.stack.segments.map((s) => s.kind)).toEqual(['space']);
    expect(state.selectedId).toBeUndefined();
    expect(state.input).toBe('ろぐ');
  });

  it('Esc はコマンド段だけ外し、スコープだけのときは状態を変えない', () => {
    const inCommand = reduce(opened, { type: 'descended', command });
    expect(reduce(inCommand, { type: 'escaped' }).stack.segments.at(-1)?.kind).toBe('project');
    expect(reduce(opened, { type: 'escaped' }).stack).toEqual(opened.stack);
  });

  it('その他のキーは削除待ちとトーストを消す', () => {
    const armed = { ...opened, stack: { ...opened.stack, armedForDelete: true } };
    const state = reduce(armed, { type: 'keyPressed' });
    expect(state.stack.armedForDelete).toBe(false);
    expect(state.toast).toBeUndefined();
  });
});

describe('トーストと Store', () => {
  it('トーストは出して、寿命が切れたら消える', () => {
    const shown = reduce(initialState, {
      type: 'toasted',
      toast: { message: 'PROJ-1 をコピーしました' },
    });
    expect(shown.toast?.message).toBe('PROJ-1 をコピーしました');
    expect(reduce(shown, { type: 'toastExpired' }).toast).toBeUndefined();
  });

  it('Store の dispatch は reduce を通して状態を更新し、購読者に届く', () => {
    const store = createPaletteStore();
    const seen: string[] = [];
    store.subscribe((state) => {
      seen.push(state.input);
    });
    store.dispatch({ type: 'inputChanged', value: 'ぼーど' });
    expect(store.state.input).toBe('ぼーど');
    expect(seen).toContain('ぼーど');
  });
});
