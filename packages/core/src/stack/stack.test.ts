import { describe, expect, it } from 'vitest';
import {
  activeCommand,
  backspace,
  canPush,
  disarm,
  emptyStack,
  pathLabels,
  pop,
  push,
  scopeOf,
} from './stack.ts';
import type { Stack } from './types.ts';

const space = { kind: 'space', spaceId: 'nulab', label: 'nulab' } as const;
const project = { kind: 'project', projectId: 'web', label: 'Webリニューアル' } as const;
const command = { kind: 'command', commandId: 'change-status', label: 'ステータスを変更' } as const;

const nulab: Stack = push(emptyStack, space);
const nulabWeb: Stack = push(nulab, project);

describe('積める組み合わせ', () => {
  it('スペースは根にだけ積める', () => {
    expect(canPush(emptyStack, space)).toBe(true);
    expect(canPush(nulab, space)).toBe(false);
  });

  it('プロジェクトはスペースの上にだけ積める', () => {
    expect(canPush(emptyStack, project)).toBe(false);
    expect(canPush(nulab, project)).toBe(true);
  });

  it('コマンドはどの階層からでも積める', () => {
    expect(canPush(emptyStack, command)).toBe(true);
    expect(canPush(nulab, command)).toBe(true);
    expect(canPush(nulabWeb, command)).toBe(true);
  });

  it('コマンドの引数はコマンドの後にだけ積める', () => {
    const arg = { kind: 'commandArg', value: 'in-progress', label: '処理中' } as const;
    expect(canPush(nulabWeb, arg)).toBe(false);
    expect(canPush(push(nulabWeb, command), arg)).toBe(true);
  });

  it('積めない組み合わせを積もうとすると失敗する', () => {
    expect(() => push(emptyStack, project)).toThrow();
  });
});

describe('⌫ による削除', () => {
  it('1 回目ではスタックは変わらず、削除待ちになる', () => {
    const armed = backspace(nulabWeb);
    expect(armed.segments).toEqual(nulabWeb.segments);
    expect(armed.armedForDelete).toBe(true);
  });

  it('2 回目で右端が 1 段だけ外れる', () => {
    const popped = backspace(backspace(nulabWeb));
    expect(popped.segments.map((s) => s.label)).toEqual(['nulab']);
    expect(popped.armedForDelete).toBe(false);
  });

  it('削除待ちは他の操作で解除される', () => {
    expect(disarm(backspace(nulabWeb)).armedForDelete).toBe(false);
    expect(push(backspace(nulab), project).armedForDelete).toBe(false);
  });

  it('根まで削ると空になり、それ以上は変化しない', () => {
    const root = pop(pop(nulabWeb));
    expect(root.segments).toEqual([]);
    expect(backspace(root)).toBe(root);
  });

  it('外れるのは常に右端で、左側は残る', () => {
    expect(pop(nulabWeb).segments.map((s) => s.kind)).toEqual(['space']);
  });
});

describe('スコープの導出', () => {
  it('スタックが空なら全スペース', () => {
    expect(scopeOf(emptyStack)).toEqual({ kind: 'allSpaces' });
  });

  it('スペースだけならそのスペース全体', () => {
    expect(scopeOf(nulab)).toEqual({ kind: 'space', spaceId: 'nulab' });
  });

  it('スペースとプロジェクトならそのプロジェクト', () => {
    expect(scopeOf(nulabWeb)).toEqual({
      kind: 'project',
      spaceId: 'nulab',
      projectId: 'web',
    });
  });

  it('コマンド階層を積んでもスコープは変わらない', () => {
    expect(scopeOf(push(nulabWeb, command))).toEqual(scopeOf(nulabWeb));
  });
});

describe('コマンド階層', () => {
  it('コマンドを積んでいなければ実行中のコマンドはない', () => {
    expect(activeCommand(nulabWeb)).toBeUndefined();
  });

  it('コマンドと選択済みの引数を取り出せる', () => {
    const withArg = push(push(nulabWeb, command), {
      kind: 'commandArg',
      value: 'in-progress',
      label: '処理中',
    });
    expect(activeCommand(withArg)).toEqual({
      commandId: 'change-status',
      label: 'ステータスを変更',
      args: ['処理中'],
    });
  });
});

describe('パス表示', () => {
  it('右端だけが削除待ちとして印される', () => {
    expect(pathLabels(backspace(nulabWeb))).toEqual([
      { label: 'nulab', armed: false },
      { label: 'Webリニューアル', armed: true },
    ]);
  });
});
