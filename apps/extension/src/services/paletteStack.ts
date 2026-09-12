import {
  activeCommand,
  backspace,
  buildCandidates,
  type CandidateLabels,
  type CandidateSection,
  canPush,
  disarm,
  emptyStack,
  type IndexEntry,
  pathLabels,
  pop,
  push,
  type Scope,
  type Stack,
  type StackSegment,
  scopeOf,
} from '@backlog-palette/core';

/**
 * モーダルの階層操作（実装プラン §4・§3 D2 / D3）。
 *
 * React の外に置く。キーから状態への写像がここだけで完結していれば、
 * 描画環境を用意せずに仕様を固定できる。
 */

export type PaletteState = {
  readonly stack: Stack;
  readonly query: string;
};

/** 入力欄のキャレット。⌫ の宛先を決めるのに使う（§13） */
export type Caret = { readonly start: number; readonly end: number };

export type PaletteEvent =
  | { type: 'query'; value: string }
  | { type: 'backspace'; caret: Caret }
  | { type: 'escape' }
  | { type: 'command'; commandId: string; label: string }
  /** 候補をスコープとして積む。Tab で「そのプロジェクトに決める」操作 */
  | { type: 'scope'; segment: StackSegment };

export type PaletteTransition = {
  readonly state: PaletteState;
  /** パレットを閉じる合図。戻る先が無くなった Esc でだけ立つ */
  readonly close: boolean;
};

/** ページ由来のスコープの初期値。スタックの初期値と索引の絞り込みに使う */
export type StackContext = { spaceKey?: string; projectKey?: string };

export function initialState(ctx: StackContext): PaletteState {
  return { stack: initialStack(ctx), query: '' };
}

function initialStack(ctx: StackContext): Stack {
  if (ctx.spaceKey === undefined) return emptyStack;

  const space = push(emptyStack, {
    kind: 'space',
    spaceId: ctx.spaceKey,
    label: ctx.spaceKey,
  });
  if (ctx.projectKey === undefined) return space;

  return push(space, { kind: 'project', projectId: ctx.projectKey, label: ctx.projectKey });
}

/**
 * Esc も ⌫ も「右端から 1 段戻す」という規則ひとつ（§3 D3）。違いは 2 つだけ。
 *
 * - ⌫ は入力文字列の削除とキーを共有するので、キャレットが先頭のときだけ
 *   スタックへ回し（§13）、取り消し線の予告を 1 回挟む（§3 D2）
 * - Esc は予告を挟まない代わりに、戻れるのはコマンド階層まで。スコープしか
 *   残っていなければ「戻る」はパレットを出ることになる
 */
export function reduce(state: PaletteState, event: PaletteEvent): PaletteTransition {
  switch (event.type) {
    case 'query':
      return stay({ stack: disarm(state.stack), query: event.value });

    case 'backspace':
      if (!atStart(event.caret)) return stay(state);
      return stay({ ...state, stack: backspace(state.stack) });

    case 'escape':
      if (activeCommand(state.stack) === undefined) return { state, close: true };
      return stay({ stack: pop(state.stack), query: '' });

    case 'command':
      return stay({
        stack: push(state.stack, {
          kind: 'command',
          commandId: event.commandId,
          label: event.label,
        }),
        query: '',
      });

    case 'scope':
      /*
       * 積めない組み合わせは黙って無視する。プロジェクトの上にプロジェクトを
       * 積もうとする入力は、利用者から見れば「そのプロジェクトに決めたい」
       * なので、エラーにするより今の階層のままにする方が読みやすい。
       */
      if (!canPush(state.stack, event.segment)) return stay(state);
      return stay({ stack: push(state.stack, event.segment), query: '' });
  }
}

function stay(state: PaletteState): PaletteTransition {
  return { state, close: false };
}

function atStart(caret: Caret): boolean {
  return caret.start === 0 && caret.end === 0;
}

export type PathView = {
  id: string;
  label: string;
  armed: boolean;
  avatar: boolean;
};

const ALL_SPACES: PathView = { id: 'allSpaces', label: '全スペース', armed: false, avatar: false };

/** 入力欄に積むパス。根まで戻ったら「全スペース」の 1 段を見せる（モック A5） */
export function pathOf(stack: Stack): readonly PathView[] {
  if (stack.segments.length === 0) return [ALL_SPACES];

  return pathLabels(stack).map((segment, index) => ({
    id: `${stack.segments[index]?.kind ?? 'segment'}:${index}`,
    ...segment,
    avatar: hasAvatar(stack.segments[index]),
  }));
}

function hasAvatar(segment: StackSegment | undefined): boolean {
  return segment?.kind === 'space' || segment?.kind === 'project';
}

export type KeyHint = { keys: readonly string[]; label: string };

const MOVE: KeyHint = { keys: ['↑', '↓'], label: '移動' };
const OPEN: KeyHint = { keys: ['↵'], label: '開く' };
const COMPLETE: KeyHint = { keys: ['⇥'], label: '候補を補完' };

/** 今その場で効くキーだけを出す（モック A4-b・A7） */
export function footerHints(state: PaletteState): readonly KeyHint[] {
  if (state.stack.armedForDelete) return [MOVE, OPEN, { keys: ['⌫'], label: '右端を 1 段削除' }];

  if (activeCommand(state.stack) !== undefined) {
    return [MOVE, OPEN, { keys: ['esc'], label: '1 つ前に戻る' }];
  }

  return [MOVE, OPEN, COMPLETE, { keys: ['⌫'], label: '右端から 1 段戻す' }];
}

/** Esc の行き先。コマンド階層にいるなら閉じずに 1 つ戻る（§3 D3） */
export function escapeLabel(state: PaletteState): string {
  return activeCommand(state.stack) === undefined ? '閉じる' : '1 つ前に戻る';
}

export type CandidateOptions = {
  state: PaletteState;
  /** ページ由来のスコープ。索引の context はこの場所を基準に付いている */
  base: StackContext;
  index: readonly IndexEntry[];
  /** スコープで絞らない行。コマンドはどの階層にいても打てる */
  commands?: readonly IndexEntry[];
  frecencyOf: (entryId: string) => number;
  labels: CandidateLabels;
};

export function candidatesFor(options: CandidateOptions): CandidateSection[] {
  const scope = scopeOf(options.state.stack);
  const scoped = options.index.filter((entry) => inScope(entry, scope, options.base));

  return buildCandidates({
    input: options.state.query,
    index: [...scoped, ...(options.commands ?? [])],
    frecencyOf: options.frecencyOf,
    labels: options.labels,
    showSpaceBadges: scope.kind === 'allSpaces',
  });
}

/**
 * 索引の行が今のスコープに入るか。
 *
 * 索引は「開いたページから見てどこか」（context）と「別スペースなら spaceKey」
 * しか持たない（services/localIndex.ts）。プロジェクト ID での判定はできないので、
 * ページのプロジェクトに属するかどうかを context で見る。スタックのプロジェクトは
 * 積み直せず外すだけなので、この 2 つは必ず一致する。
 */
function inScope(entry: IndexEntry, scope: Scope, base: StackContext): boolean {
  switch (scope.kind) {
    case 'allSpaces':
      return true;
    case 'space':
      return (entry.spaceKey ?? base.spaceKey) === scope.spaceId;
    case 'project':
      return (
        (entry.spaceKey ?? base.spaceKey) === scope.spaceId && entry.context === 'currentProject'
      );
  }
}
