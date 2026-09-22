import { type KeyboardEvent, type Ref, useState } from 'react';

import { cn } from '@/components/utils/cn';

type PaletteInputProps = {
  value: string;
  placeholder: string;
  completion?: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  ref?: Ref<HTMLInputElement>;
  id?: string;
  'aria-label': string;
  'aria-controls'?: string;
  'aria-activedescendant'?: string;
};

function GhostCompletion({ value, completion }: { value: string; completion: string }) {
  return (
    <div
      aria-hidden
      data-testid="ghost-completion"
      className="pointer-events-none absolute inset-0 flex items-center overflow-hidden font-body text-md whitespace-pre select-none"
    >
      <span className="invisible">{value}</span>
      <span className="text-subtle">{completion}</span>
    </div>
  );
}

export function PaletteInput({
  value,
  placeholder,
  completion,
  onChange,
  onKeyDown,
  ref,
  id,
  ...aria
}: PaletteInputProps) {
  const [composing, setComposing] = useState(false);
  const showGhost = completion !== undefined && completion !== '' && !composing && value !== '';

  return (
    <div className="relative min-w-0 flex-1">
      {showGhost && <GhostCompletion value={value} completion={completion} />}
      <input
        ref={ref}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded
        aria-controls={aria['aria-controls']}
        aria-activedescendant={aria['aria-activedescendant']}
        aria-label={aria['aria-label']}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        data-composing={composing ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        className={cn(
          'relative h-full w-full min-w-0 border-0 bg-transparent p-0 font-body text-md text-ellipsis text-default outline-none placeholder:text-ellipsis placeholder:text-subtle',
          composing && 'underline decoration-1 decoration-dotted underline-offset-2',
        )}
      />
    </div>
  );
}
