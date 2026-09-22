import { type Ref, type RefObject, useEffect, useId, useImperativeHandle, useRef } from 'react';

import { type Labels, useLabels } from '@/components/labels';
import { CandidateList, optionDomId } from '@/components/organisms/CandidateList';
import { PaletteFooter } from '@/components/organisms/PaletteFooter';
import { PaletteHeader } from '@/components/organisms/PaletteHeader';
import { Overlay } from '@/components/templates/Overlay';
import { PaletteFrame } from '@/components/templates/PaletteFrame';
import type { FocusHandle, PaletteView } from '@/components/types';

import { usePaletteKeyHandler } from './Palette.handler';

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
    /** container は開くたびに focus() を呼ぶ */
    ref?: Ref<FocusHandle>;
  };

/*
 * 入力欄はパレットが描かれている間ずっとフォーカスを持つ（仮想フォーカス、§6）。
 * マウント時だけだと、埋め込み側がフレームへフォーカスを移したときに入力欄まで戻らず、
 * 打鍵が document に落ちて消える。
 *
 * window の focus イベントは埋め込み側が表示を切り替えたときに必ず来るとは限らない
 * （Firefox では来ない）。それだけに頼らず、開き直したときは container が ref の focus() を呼ぶ
 */
function useKeepFocus(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    focus();
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('focus', focus);
    };
  }, [inputRef]);
}

export function Palette({ ref, ...props }: PaletteProps) {
  const { sections, selectedId, footer } = props;
  const labels = useLabels(props.labels);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${useId()}list`;
  const handleKeyDown = usePaletteKeyHandler(props, listId);

  useKeepFocus(inputRef);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

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
            activeDescendant={
              selectedId === undefined ? undefined : optionDomId(listId, selectedId)
            }
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
