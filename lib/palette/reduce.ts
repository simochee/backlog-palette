import { backspace, disarm, escape, pushCommand, pushProject, pushSpace } from '@/lib/stack/stack';
import type { Stack } from '@/lib/stack/types';

import type { PaletteAction, PaletteState, TakeTarget } from './state';

function withStack(state: PaletteState, stack: Stack): PaletteState {
  return {
    ...state,
    stack,
    input: '',
    selectedId: undefined,
    session: undefined,
    toast: undefined,
  };
}

function take(state: PaletteState, target: TakeTarget): PaletteState {
  switch (target.kind) {
    case 'space':
      return withStack(state, pushSpace(state.stack, target.space));
    case 'project':
      return withStack(state, pushProject(state.stack, target.space, target.project));
    case 'command':
      return withStack(state, pushCommand(state.stack, target.command));
    case 'complete':
      return {
        ...state,
        stack: disarm(state.stack),
        input: target.text,
        selectedId: undefined,
        session: undefined,
        toast: undefined,
      };
    default:
      return state;
  }
}

/** 段が外れたら候補が入れ替わるので選択は先頭へ。削除待ちになっただけなら動かさない */
function popped(state: PaletteState, stack: Stack): PaletteState {
  const changed = stack.segments.length !== state.stack.segments.length;
  return {
    ...state,
    stack,
    selectedId: changed ? undefined : state.selectedId,
    session: changed ? undefined : state.session,
    toast: undefined,
  };
}

/**
 * 遷移の純粋関数（tech-stack §3.3）。非同期はせず、到着も 1 アクションとして受ける。
 * 選択を先頭に戻すのは undefined を置くだけで、行 id の解決は derive が行う。
 */
export function reduce(state: PaletteState, action: PaletteAction): PaletteState {
  switch (action.type) {
    case 'opened':
      return { ...withStack(state, action.stack) };
    case 'inputChanged':
      return {
        ...state,
        stack: disarm(state.stack),
        input: action.value,
        selectedId: undefined,
        session: undefined,
        toast: undefined,
      };
    case 'selected':
      return { ...state, stack: disarm(state.stack), selectedId: action.id, toast: undefined };
    case 'took':
      return take(state, action.target);
    case 'descended':
      return withStack(state, pushCommand(state.stack, action.command));
    case 'backspacedAtStart':
      return popped(state, backspace(state.stack));
    case 'escaped':
      return popped(state, escape(state.stack));
    case 'keyPressed':
      return { ...state, stack: disarm(state.stack), toast: undefined };
    case 'toasted':
      return { ...state, toast: action.toast };
    case 'toastExpired':
      return { ...state, toast: undefined };
    default:
      return state;
  }
}
