import { Search } from 'lucide-react';
import type { KeyboardEvent, Ref } from 'react';

import { Kbd } from '@/components/atoms/Kbd';
import { PaletteInput } from '@/components/molecules/PaletteInput';
import { ScopePath } from '@/components/molecules/ScopePath';
import type { PaletteView, PathSegmentView } from '@/components/types';

type PaletteHeaderProps = {
  path: readonly PathSegmentView[];
  input: PaletteView['input'];
  armedNotice?: string;
  escLabel: string;
  inputLabel: string;
  onInputChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  listId?: string;
  activeDescendant?: string;
};

export function PaletteHeader({
  path,
  input,
  armedNotice,
  escLabel,
  inputLabel,
  onInputChange,
  onKeyDown,
  inputRef,
  listId,
  activeDescendant,
}: PaletteHeaderProps) {
  return (
    <div className="flex flex-col">
      <div className="flex h-(--bp-size-header) items-center gap-2 px-3">
        <Search aria-hidden className="size-(--bp-size-icon) shrink-0 text-subtle" />
        <ScopePath segments={path} />
        <PaletteInput
          ref={inputRef}
          value={input.value}
          placeholder={input.placeholder}
          completion={input.completion}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          aria-label={inputLabel}
          aria-controls={listId}
          aria-activedescendant={activeDescendant}
        />
        {armedNotice === undefined ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-subtle">
            <Kbd keys={['esc']} dim />
            <span className="@max-narrow:hidden">{escLabel}</span>
          </span>
        ) : (
          // 予告は esc ヒントの位置に入れ替えて出す。行を足すと高さが変わりレイアウトシフトになる
          <output className="flex shrink-0 items-center gap-1 text-xs text-warning">
            <Kbd keys={['⌫']} />
            <span>{armedNotice}</span>
          </output>
        )}
      </div>
    </div>
  );
}
