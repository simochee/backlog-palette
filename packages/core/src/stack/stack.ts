import type { ActiveCommand, Scope, Stack, StackSegment } from './types.ts';

export const emptyStack: Stack = { segments: [], armedForDelete: false };

function lastOf(stack: Stack): StackSegment | undefined {
  return stack.segments[stack.segments.length - 1];
}

/**
 * 意味の通る組み合わせしか作れないようにする。
 * 「全スペース / Webリニューアル」のような、スペースを飛ばしたプロジェクト指定を防ぐ。
 */
export function canPush(stack: Stack, segment: StackSegment): boolean {
  const last = lastOf(stack);

  switch (segment.kind) {
    case 'space':
      return last === undefined;
    case 'project':
      return last?.kind === 'space';
    case 'command':
      return last === undefined || last.kind === 'space' || last.kind === 'project';
    case 'commandArg':
      return last?.kind === 'command' || last?.kind === 'commandArg';
  }
}

export function push(stack: Stack, segment: StackSegment): Stack {
  if (!canPush(stack, segment)) {
    throw new Error(`cannot push ${segment.kind} onto [${stack.segments.map((s) => s.kind)}]`);
  }
  return { segments: [...stack.segments, segment], armedForDelete: false };
}

export function pop(stack: Stack): Stack {
  if (stack.segments.length === 0) return emptyStack;
  return { segments: stack.segments.slice(0, -1), armedForDelete: false };
}

export function disarm(stack: Stack): Stack {
  return stack.armedForDelete ? { ...stack, armedForDelete: false } : stack;
}

/**
 * ⌫ の一手。1 回目は削除待ちにするだけで、2 回目で外す。
 *
 * IME で打った文字が意図せず消える事故を防ぐための 2 段階（§3 D2）。
 * 入力文字列の削除と同じキーを共有するので、取り消し線という
 * 見える予告を挟まないと「消えたのはどっちか」が分からなくなる。
 */
export function backspace(stack: Stack): Stack {
  if (stack.segments.length === 0) return stack;
  return stack.armedForDelete ? pop(stack) : { ...stack, armedForDelete: true };
}

/** 検索スコープはスタックから導出する。別の状態として持たない（§4） */
export function scopeOf(stack: Stack): Scope {
  const space = stack.segments.find((s) => s.kind === 'space');
  if (space === undefined) return { kind: 'allSpaces' };

  const project = stack.segments.find((s) => s.kind === 'project');
  if (project === undefined) return { kind: 'space', spaceId: space.spaceId };

  return { kind: 'project', spaceId: space.spaceId, projectId: project.projectId };
}

export function activeCommand(stack: Stack): ActiveCommand | undefined {
  const index = stack.segments.findIndex((s) => s.kind === 'command');
  if (index === -1) return undefined;

  const command = stack.segments[index];
  if (command?.kind !== 'command') return undefined;

  return {
    commandId: command.commandId,
    label: command.label,
    args: stack.segments.slice(index + 1).map((s) => s.label),
  };
}

/** 入力欄に出すパス表示。右端が現在地で、armed なら取り消し線を付ける */
export function pathLabels(stack: Stack): readonly { label: string; armed: boolean }[] {
  const lastIndex = stack.segments.length - 1;
  return stack.segments.map((segment, i) => ({
    label: segment.label,
    armed: stack.armedForDelete && i === lastIndex,
  }));
}
