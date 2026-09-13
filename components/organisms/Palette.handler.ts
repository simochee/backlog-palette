import type { KeyboardEvent } from 'react';

import { flattenRows } from '@/components/organisms/CandidateList';
import type { KeyHint, SectionView } from '@/components/types';

import type { PaletteProps } from './Palette';
import { type KeyDecision, type KeyLike, resolveKey } from './Palette.keys';

export type KeyCallbacks = {
  onSelectionChange: (id: string) => void;
  onAction: (id: string, opts: { newTab: boolean }) => void;
  onTake: (id: string) => void;
  onBackspaceAtStart?: () => void;
  onEscape?: () => void;
  onCopySearchUrl?: () => void;
  onOpenPanel?: () => void;
};

function domSelectedRowId(listId: string): string | undefined {
  return document
    .querySelector(`#${CSS.escape(listId)}`)
    ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.dataset.rowId;
}

export function dispatchKeyDecision(
  decision: KeyDecision,
  event: KeyboardEvent<HTMLInputElement>,
  props: KeyCallbacks,
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
      props.onBackspaceAtStart?.();
      return;
    case 'escape':
      event.preventDefault();
      props.onEscape?.();
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

export function keyLikeOf(event: KeyboardEvent<HTMLInputElement>): KeyLike {
  return {
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    isComposing: event.nativeEvent.isComposing,
  };
}

type KeyView = {
  sections: readonly SectionView[];
  selectedId?: string;
  footer: readonly KeyHint[];
};

/** 宛先は props の selectedId ではなく DOM 上で選択されている行から引き直す（palette.md §6 の ↵） */
export function resolveKeyFor(
  event: KeyboardEvent<HTMLInputElement>,
  view: KeyView,
  listId: string,
): KeyDecision {
  const rows = flattenRows(view.sections);
  const domSelected = domSelectedRowId(listId);
  const target = rows.find((row) => row.id === domSelected) ?? rows[0];
  const input = event.currentTarget;
  return resolveKey(keyLikeOf(event), {
    rows,
    target,
    selectedId: view.selectedId,
    caretAtStart: input.selectionStart === 0 && input.selectionEnd === 0,
    footer: new Set(view.footer.map((hint) => hint.id)),
  });
}

/** 入力欄の keydown を palette.md §6 のカタログに写す */
export function usePaletteKeyHandler(props: PaletteProps, listId: string) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    dispatchKeyDecision(resolveKeyFor(event, props, listId), event, props);
  };
}
