import type {
  CommandSegment,
  ProjectSegment,
  Scope,
  Segment,
  SpaceSegment,
  Stack,
} from './types';

export const emptyStack: Stack = { segments: [], armedForDelete: false };

function withSegments(segments: readonly Segment[]): Stack {
  return { segments, armedForDelete: false };
}

function last(stack: Stack): Segment | undefined {
  return stack.segments.at(-1);
}

export function spaceOf(stack: Stack): SpaceSegment | undefined {
  return stack.segments.find((segment) => segment.kind === 'space');
}

export function projectOf(stack: Stack): ProjectSegment | undefined {
  return stack.segments.find((segment) => segment.kind === 'project');
}

export function activeCommand(stack: Stack): CommandSegment | undefined {
  const segment = last(stack);
  return segment?.kind === 'command' ? segment : undefined;
}

/** 開いたときの既定。現在ページから決まる（palette.md §3） */
export function stackOf(space?: SpaceSegment, project?: ProjectSegment): Stack {
  if (space === undefined) return emptyStack;
  return withSegments(project === undefined ? [space] : [space, project]);
}

/** スコープは別の状態として持たず、スタックから導く（§2） */
export function scopeOf(stack: Stack): Scope {
  const space = spaceOf(stack);
  if (space === undefined) return { kind: 'root' };
  const project = projectOf(stack);
  if (project === undefined) return { kind: 'space', spaceId: space.spaceId };
  return { kind: 'project', spaceId: space.spaceId, projectId: project.projectId };
}

/** `space` 行で ⇥。スコープはこの 1 段に置き換わる。コマンド階層では積めない */
export function pushSpace(stack: Stack, space: SpaceSegment): Stack {
  if (activeCommand(stack) !== undefined) return stack;
  return withSegments([space]);
}

/**
 * `project` 行で ⇥。`project` の前には必ず `space` があるので、別スペースの
 * プロジェクトを積むときは `space` も一緒に置き換わる（§8）
 */
export function pushProject(stack: Stack, space: SpaceSegment, project: ProjectSegment): Stack {
  if (activeCommand(stack) !== undefined) return stack;
  return withSegments([space, project]);
}

/** 2 段階コマンドの行で ↵。コマンドは 1 段だけで、コマンドの上には積めない */
export function pushCommand(stack: Stack, command: CommandSegment): Stack {
  if (activeCommand(stack) !== undefined) return stack;
  return withSegments([...stack.segments, command]);
}

function pop(stack: Stack): Stack {
  return withSegments(stack.segments.slice(0, -1));
}

/**
 * キャレット先頭の ⌫。スコープは 1 回目で削除待ち、2 回目で外す。入力文字と
 * 同じキーを共有するので、取り消し線の予告を挟まないと「消えたのはどちらか」が
 * 分からなくなる。コマンドは外しても失うものが無いので予告を経ない（D-6）
 */
export function backspace(stack: Stack): Stack {
  const segment = last(stack);
  if (segment === undefined) return stack;
  if (segment.kind === 'command') return pop(stack);
  return stack.armedForDelete ? pop(stack) : { ...stack, armedForDelete: true };
}

/** Esc はコマンド段だけ外す。スコープだけのときは変えない（呼び出し側が閉じる。D-6） */
export function escape(stack: Stack): Stack {
  return activeCommand(stack) === undefined ? stack : pop(stack);
}

/** 削除待ちはキー入力・入力変更で解除される。スタック変更は各操作が自分で解除する */
export function disarm(stack: Stack): Stack {
  return stack.armedForDelete ? { ...stack, armedForDelete: false } : stack;
}
