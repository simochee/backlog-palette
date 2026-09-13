import type { KeyHintId, RowView } from '@/components/types';

export type KeyLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing: boolean;
};

export type KeyContext = {
  rows: readonly RowView[];
  /** 選択行。仕様どおり DOM 上で選択されている行を優先し、無ければ先頭行 */
  target: RowView | undefined;
  selectedId: string | undefined;
  caretAtStart: boolean;
  footer: ReadonlySet<KeyHintId>;
};

export type KeyDecision =
  | { type: 'none'; preventDefault: boolean }
  | { type: 'move'; to: string }
  | { type: 'action'; id: string; newTab: boolean }
  | { type: 'take'; id: string }
  | { type: 'backspaceAtStart' }
  | { type: 'escape' }
  | { type: 'copyUrl' }
  | { type: 'openPanel' };

function isComposing(event: KeyLike): boolean {
  return event.isComposing || event.key === 'Process';
}

function neighbour(rows: readonly RowView[], selectedId: string | undefined, delta: 1 | -1) {
  if (rows.length === 0) return undefined;
  const index = rows.findIndex((row) => row.id === selectedId);
  if (index === -1) return rows[0];
  return rows[index + delta];
}

/**
 * palette.md §6・§13 のキーのカタログを 1 箇所で解釈する。副作用を持たず、
 * どのハンドラを呼ぶかだけを返す。変換中のキーはすべて捨てる（I5）。
 * Tab は取り込める行が無くても既定動作を止める（I3）。
 */
export function resolveKey(event: KeyLike, context: KeyContext): KeyDecision {
  const mod = event.metaKey || event.ctrlKey;

  if (isComposing(event)) return { type: 'none', preventDefault: event.key === 'Tab' };

  if (event.key === 'Tab') {
    const hints = context.target?.hints ?? [];
    if (!event.shiftKey && context.target && (hints.includes('complete') || hints.includes('stack')))
      return { type: 'take', id: context.target.id };
    return { type: 'none', preventDefault: true };
  }

  if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
    const next = neighbour(context.rows, context.selectedId, 1);
    return next === undefined || next.id === context.selectedId
      ? { type: 'none', preventDefault: true }
      : { type: 'move', to: next.id };
  }

  if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
    const previous = neighbour(context.rows, context.selectedId, -1);
    return previous === undefined || previous.id === context.selectedId
      ? { type: 'none', preventDefault: true }
      : { type: 'move', to: previous.id };
  }

  if (event.key === 'Enter') {
    const target = context.target;
    if (target === undefined) return { type: 'none', preventDefault: true };
    if (mod) {
      return target.hints.includes('modEnter')
        ? { type: 'action', id: target.id, newTab: true }
        : { type: 'none', preventDefault: true };
    }
    return target.hints.length > 0
      ? { type: 'action', id: target.id, newTab: false }
      : { type: 'none', preventDefault: true };
  }

  if (event.key === 'Backspace' && context.caretAtStart && !mod && !event.altKey)
    return { type: 'backspaceAtStart' };

  if (event.key === 'Escape') return { type: 'escape' };

  if (mod && event.shiftKey && event.key.toLowerCase() === 'c' && context.footer.has('copyUrl'))
    return { type: 'copyUrl' };

  if (mod && event.key === 'ArrowRight' && context.footer.has('toPanel'))
    return { type: 'openPanel' };

  return { type: 'none', preventDefault: false };
}
