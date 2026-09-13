import type { KeyboardEvent } from 'react';

import { flattenRows } from '@/components/organisms/CandidateList';

import type { PaletteProps } from './Palette';
import { type KeyDecision, resolveKey } from './Palette.keys';

function domSelectedRowId(listId: string): string | undefined {
  return document
    .querySelector(`#${CSS.escape(listId)}`)
    ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.dataset.rowId;
}

function dispatch(
  decision: KeyDecision,
  event: KeyboardEvent<HTMLInputElement>,
  props: PaletteProps,
) {
  switch (decision.type) {
    case 'none':
      if (decision.preventDefault) event.preventDefault();
      return;
    case 'move':
      event.preventDefault();
      props.onSelectionChange(decision.to);
      return;
    case 'action':
      event.preventDefault();
      props.onAction(decision.id, { newTab: decision.newTab });
      return;
    case 'take':
      event.preventDefault();
      props.onTake(decision.id);
      return;
    case 'backspaceAtStart':
      props.onBackspaceAtStart();
      return;
    case 'escape':
      event.preventDefault();
      props.onEscape();
      return;
    case 'copyUrl':
      event.preventDefault();
      props.onCopySearchUrl?.();
      return;
    case 'openPanel':
      event.preventDefault();
      props.onOpenPanel?.();
  }
}

/**
 * 入力欄の keydown を palette.md §6 のカタログに写す。Enter の宛先は props の selectedId
 * ではなく DOM 上で選択されている行から引き直す（描画と押下の間で状態が動いても、
 * 利用者が見ている行が対象になる）。
 */
export function usePaletteKeyHandler(props: PaletteProps, listId: string) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    const rows = flattenRows(props.sections);
    const domSelected = domSelectedRowId(listId);
    const target = rows.find((row) => row.id === domSelected) ?? rows[0];
    const input = event.currentTarget;
    const decision = resolveKey(
      {
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        isComposing: event.nativeEvent.isComposing,
      },
      {
        rows,
        target,
        selectedId: props.selectedId,
        caretAtStart: input.selectionStart === 0 && input.selectionEnd === 0,
        footer: new Set(props.footer.map((hint) => hint.id)),
      },
    );
    dispatch(decision, event, props);
  };
}
