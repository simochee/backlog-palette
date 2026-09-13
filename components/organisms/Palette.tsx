import { type KeyboardEvent, useEffect, useId, useRef } from 'react';

import { type Labels, useLabels } from '@/components/labels';
import {
  CandidateList,
  flattenRows,
  optionDomId,
} from '@/components/organisms/CandidateList';
import { PaletteFooter } from '@/components/organisms/PaletteFooter';
import { PaletteHeader } from '@/components/organisms/PaletteHeader';
import { Overlay } from '@/components/templates/Overlay';
import { PaletteFrame } from '@/components/templates/PaletteFrame';
import type { PaletteView } from '@/components/types';

import { type KeyDecision, resolveKey } from './Palette.keys';

export type PaletteCallbacks = {
  onInputChange: (value: string) => void;
  onSelectionChange: (id: string) => void;
  onAction: (id: string, opts: { newTab: boolean }) => void;
  onTake: (id: string) => void;
  onBackspaceAtStart: () => void;
  onEscape: () => void;
  onCopySearchUrl?: () => void;
  onOpenPanel?: () => void;
  onDismiss?: () => void;
};

export type PaletteProps = PaletteView &
  PaletteCallbacks & {
    labels?: Partial<Labels>;
    width?: number;
  };

function domSelectedRowId(listId: string): string | undefined {
  return document
    .getElementById(listId)
    ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.dataset.rowId;
}

export function Palette(props: PaletteProps) {
  const { sections, selectedId, footer } = props;
  const labels = useLabels(props.labels);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${useId()}list`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const dispatch = (decision: KeyDecision, event: KeyboardEvent<HTMLInputElement>) => {
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
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const rows = flattenRows(sections);
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
        selectedId,
        caretAtStart: input.selectionStart === 0 && input.selectionEnd === 0,
        footer: new Set(footer.map((hint) => hint.id)),
      },
    );
    dispatch(decision, event);
  };

  return (
    <Overlay onDismiss={props.onDismiss}>
      <PaletteFrame
        aria-label={labels.brand}
        width={props.width}
        header={
          <PaletteHeader
            path={props.path}
            input={props.input}
            armedNotice={props.armedNotice}
            escLabel={props.escLabel}
            inputLabel={labels.palette.inputLabel}
            onInputChange={props.onInputChange}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            listId={listId}
            activeDescendant={selectedId === undefined ? undefined : optionDomId(listId, selectedId)}
          />
        }
        list={
          <CandidateList
            id={listId}
            sections={sections}
            selectedId={selectedId}
            onAction={(id) => props.onAction(id, { newTab: false })}
            aria-label={labels.palette.listLabel}
          />
        }
        footer={<PaletteFooter hints={footer} toast={props.toast} brand={labels.brand} />}
      />
    </Overlay>
  );
}
