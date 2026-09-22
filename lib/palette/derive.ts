import type { Labels } from '@/components/labels';
import type { PaletteView, PathSegmentView } from '@/components/types';
import { deriveBindings, type KeyBinding } from '@/lib/keys/bindings';
import { type Platform, toKeyHints } from '@/lib/keys/match';
import { fold } from '@/lib/query/normalize';
import { activeCommand, scopeOf } from '@/lib/stack/stack';
import type { CommandSegment, Scope, Stack } from '@/lib/stack/types';

import { buildSections, type Env } from './build';
import type { PaletteIndex } from './model';
import type { Built, RowAction } from './rows';
import { capSections } from './sections';
import type { PaletteState, TakeTarget } from './state';

export type DeriveOptions = { platform: Platform; panelAvailable: boolean };

export type DerivedPalette = {
  view: PaletteView;
  bindings: readonly KeyBinding[];
  /** 行 id → ↵ で起きること */
  actions: ReadonlyMap<string, RowAction>;
  /** 行 id → ⇥ で取り込むもの */
  takes: ReadonlyMap<string, TakeTarget>;
};

function scopeLabel(stack: Stack, labels: Labels): string {
  const last = stack.segments.findLast((s) => s.kind !== 'command');
  return last?.label ?? labels.palette.rootScope;
}

function pathOf(stack: Stack): PathSegmentView[] {
  const lastIndex = stack.segments.length - 1;
  return stack.segments.map((segment, i) => ({
    id:
      segment.kind === 'command'
        ? `command:${segment.commandId}`
        : `${segment.kind}:${segment.kind === 'space' ? segment.spaceId : segment.projectId}`,
    label: segment.label,
    badge: segment.kind !== 'command',
    icon: segment.kind === 'space' ? segment.icon : undefined,
    armed: stack.armedForDelete && i === lastIndex ? true : undefined,
  }));
}

/** ゴースト補完: 先頭行の補完テキストが入力に前方一致するとき、その続きだけ */
function completionOf(input: string, selected: Built | undefined): string | undefined {
  if (input === '' || selected?.take?.kind !== 'complete') return undefined;
  const text = selected.take.text;
  const folded = fold(input);
  if (folded.length !== input.length || !fold(text).startsWith(folded)) return undefined;
  return text.length > input.length ? text.slice(input.length) : undefined;
}

function bindingsOf(
  state: PaletteState,
  rows: readonly Built[],
  selected: Built | undefined,
  labels: Labels,
  options: DeriveOptions,
): KeyBinding[] {
  return deriveBindings(
    {
      selected: selected?.row,
      rowCount: rows.length,
      popLabel: state.stack.segments.at(-1)?.label,
      hasInput: state.input.trim() !== '',
      hasResults: (state.session?.rows.length ?? 0) > 0,
      panelAvailable: options.panelAvailable,
    },
    labels,
  );
}

/** 入力欄の案内。どの階層にいるかで、入力が何に効くかが変わる */
function placeholderOf(scope: Scope, command: CommandSegment | undefined, labels: Labels): string {
  // 何の階層かはスコープパスの右端が言っている。ここで名前を繰り返さない
  if (command !== undefined) return labels.palette.commandPlaceholder;
  return scope.kind === 'root' ? labels.palette.rootPlaceholder : labels.palette.placeholder;
}

/** 削除待ちの段。予告とフッターの文言はこの段の名前で語る（§8） */
function armedSegment(state: PaletteState) {
  return state.stack.armedForDelete ? state.stack.segments.at(-1) : undefined;
}

export function derive(
  state: PaletteState,
  index: PaletteIndex,
  labels: Labels,
  options: DeriveOptions,
): DerivedPalette {
  const scope = scopeOf(state.stack);
  const env: Env = { index, scope, labels, session: state.session };
  const { sections, rows } = capSections(
    buildSections(state, env, scopeLabel(state.stack, labels)),
    labels,
  );
  const command = activeCommand(state.stack);
  const selected =
    rows.find((r) => r.row.id === state.selectedId) ??
    rows.find((r) => r.row.hints.length > 0) ??
    rows[0];
  const bindings = bindingsOf(state, rows, selected, labels, options);
  const inCommand = command !== undefined;

  const actions = new Map<string, RowAction>();
  const takes = new Map<string, TakeTarget>();
  for (const { row, action, take } of rows) {
    if (action !== undefined) actions.set(row.id, action);
    if (take !== undefined) takes.set(row.id, take);
  }

  return {
    view: {
      path: pathOf(state.stack),
      input: {
        value: state.input,
        placeholder: placeholderOf(scope, command, labels),
        completion: completionOf(state.input, selected),
      },
      armedNotice: (() => {
        const armed = armedSegment(state);
        return armed === undefined ? undefined : labels.palette.armedNotice(armed.label);
      })(),
      escLabel: inCommand ? labels.palette.escBack : labels.palette.escClose,
      sections,
      selectedId: selected?.row.id,
      footer: toKeyHints(bindings, options.platform),
      toast: state.toast,
    },
    bindings,
    actions,
    takes,
  };
}
