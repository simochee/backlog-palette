import { describe, expect, it } from 'vitest';

import {
  activeCommand,
  backspace,
  disarm,
  emptyStack,
  escape,
  pushCommand,
  pushProject,
  pushSpace,
  scopeOf,
  stackOf,
} from './stack';
import type { CommandSegment, ProjectSegment, SpaceSegment } from './types';

const nulab: SpaceSegment = { kind: 'space', spaceId: 'nulab', label: 'ヌーラボ' };
const acme: SpaceSegment = { kind: 'space', spaceId: 'acme', label: 'Acme Inc.' };
const web: ProjectSegment = {
  kind: 'project',
  projectId: '1',
  projectKey: 'PROJ',
  label: 'Webリニューアル',
};
const helpdesk: ProjectSegment = {
  kind: 'project',
  projectId: '9',
  projectKey: 'HELP',
  label: '社内ヘルプデスク',
};
const switchSpace: CommandSegment = {
  kind: 'command',
  commandId: 'switch-space',
  label: 'スペースを切り替え',
};

const kinds = (stack: { segments: readonly { kind: string }[] }) =>
  stack.segments.map((segment) => segment.kind);

describe('開いたときの既定', () => {
  it('課題やプロジェクト配下のページでは [space / project] が積まれる', () => {
    expect(kinds(stackOf(nulab, web))).toEqual(['space', 'project']);
  });

  it('スペース直下のページでは [space] だけが積まれる', () => {
    expect(kinds(stackOf(nulab))).toEqual(['space']);
  });

  it('スペースが分からなければ根から始まる', () => {
    expect(stackOf()).toEqual(emptyStack);
  });
});

describe('⇥ で積む', () => {
  it('根で space を積むと [space] になる', () => {
    expect(kinds(pushSpace(emptyStack, nulab))).toEqual(['space']);
  });

  it('[space] で project を積むと [space / project] になる', () => {
    expect(scopeOf(pushProject(stackOf(nulab), nulab, web))).toEqual({
      kind: 'project',
      spaceId: 'nulab',
      projectId: '1',
    });
  });

  it('別スペースの project を積むと space も一緒に置き換わる', () => {
    const stack = pushProject(stackOf(nulab, web), acme, helpdesk);
    expect(scopeOf(stack)).toEqual({ kind: 'project', spaceId: 'acme', projectId: '9' });
  });

  it('根から project を積んでも project の前には space がある', () => {
    expect(kinds(pushProject(emptyStack, acme, helpdesk))).toEqual(['space', 'project']);
  });

  it('[space / project] で別の space を積むと [space] だけに戻る', () => {
    expect(scopeOf(pushSpace(stackOf(nulab, web), acme))).toEqual({
      kind: 'space',
      spaceId: 'acme',
    });
  });

  it('積むと削除待ちは解除される', () => {
    const armed = backspace(stackOf(nulab));
    expect(pushProject(armed, nulab, web).armedForDelete).toBe(false);
  });
});

describe('コマンド階層', () => {
  it('2 段階コマンドの ↵ で command が右端に積まれる', () => {
    const stack = pushCommand(stackOf(nulab), switchSpace);
    expect(kinds(stack)).toEqual(['space', 'command']);
    expect(activeCommand(stack)?.commandId).toBe('switch-space');
  });

  it('command を積んでもスコープは変わらない', () => {
    expect(scopeOf(pushCommand(stackOf(nulab), switchSpace))).toEqual({
      kind: 'space',
      spaceId: 'nulab',
    });
  });

  it('command の後に space / project は積めない', () => {
    const stack = pushCommand(stackOf(nulab), switchSpace);
    expect(pushSpace(stack, acme)).toBe(stack);
    expect(pushProject(stack, acme, helpdesk)).toBe(stack);
  });

  it('command は 1 段しか積めない', () => {
    const stack = pushCommand(stackOf(nulab), switchSpace);
    expect(pushCommand(stack, { ...switchSpace, commandId: 'other' })).toBe(stack);
  });
});

describe('⌫ の 2 段', () => {
  it('1 回目ではスタックは変わらず削除待ちになる', () => {
    const stack = stackOf(nulab, web);
    const armed = backspace(stack);
    expect(armed.segments).toEqual(stack.segments);
    expect(armed.armedForDelete).toBe(true);
  });

  it('2 回目で右端のスコープが外れ、project → space → 根 の順に戻る', () => {
    const afterProject = backspace(backspace(stackOf(nulab, web)));
    expect(scopeOf(afterProject)).toEqual({ kind: 'space', spaceId: 'nulab' });
    const afterSpace = backspace(backspace(afterProject));
    expect(scopeOf(afterSpace)).toEqual({ kind: 'root' });
  });

  it('外した直後は削除待ちではない', () => {
    expect(backspace(backspace(stackOf(nulab, web))).armedForDelete).toBe(false);
  });

  it('削除待ちのまま文字を打つと解除され、スタックは変わらない', () => {
    const stack = stackOf(nulab, web);
    const released = disarm(backspace(stack));
    expect(released.armedForDelete).toBe(false);
    expect(released.segments).toEqual(stack.segments);
  });

  it('削除待ちでなければ disarm は同じスタックを返す', () => {
    const stack = stackOf(nulab);
    expect(disarm(stack)).toBe(stack);
  });

  it('コマンド段は ⌫ 1 回で外れ、削除待ちを経ない', () => {
    const stack = backspace(pushCommand(stackOf(nulab), switchSpace));
    expect(kinds(stack)).toEqual(['space']);
    expect(stack.armedForDelete).toBe(false);
  });

  it('根では ⌫ で何も起きない', () => {
    expect(backspace(emptyStack)).toBe(emptyStack);
  });
});

describe('Esc', () => {
  it('コマンド階層では右端のコマンドだけ外す', () => {
    expect(kinds(escape(pushCommand(stackOf(nulab, web), switchSpace)))).toEqual([
      'space',
      'project',
    ]);
  });

  it('スコープだけのときはスタックを変えない（閉じるのは呼び出し側）', () => {
    const stack = stackOf(nulab, web);
    expect(escape(stack)).toBe(stack);
  });
});
