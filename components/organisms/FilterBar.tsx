import { ChevronDown, X } from 'lucide-react';
import { Popover, RadioGroup } from 'radix-ui';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { type Labels, useLabels } from '@/components/labels';
import type { FilterField } from '@/components/types';
import { cn } from '@/components/utils/cn';

type FilterBarProps = {
  fields: readonly FilterField[];
  onChange: (fieldId: string, optionId: string) => void;
  onClearAll: () => void;
  compact?: boolean;
  labels?: Partial<Labels>;
};

export function isFieldActive(field: FilterField): boolean {
  return field.neutralValue !== undefined && field.value !== field.neutralValue;
}

function OptionList({
  field,
  onChange,
  singleChoice,
}: {
  field: FilterField;
  onChange: (optionId: string) => void;
  singleChoice: string;
}) {
  return (
    <Popover.Content
      align="start"
      sideOffset={4}
      className="z-10 min-w-48 rounded-surface border border-border bg-floating p-2 font-body text-default shadow-floating"
    >
      <RadioGroup.Root
        value={field.value}
        onValueChange={onChange}
        aria-label={field.label}
        className="flex flex-col"
      >
        {field.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-sunken"
          >
            <RadioGroup.Item
              value={option.id}
              className="flex size-4 shrink-0 items-center justify-center rounded-pill border border-border-strong bg-control outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-accent"
            >
              <RadioGroup.Indicator className="size-2 rounded-pill bg-accent" />
            </RadioGroup.Item>
            <span className="flex-1 truncate">{option.label}</span>
            {option.tone !== undefined && <Badge label={option.label} tone={option.tone} dot />}
            {option.count !== undefined && (
              <span className="font-mono text-xs text-subtle">{option.count}</span>
            )}
          </label>
        ))}
      </RadioGroup.Root>
      <p className="px-2 pt-1 text-xs text-subtle">{singleChoice}</p>
    </Popover.Content>
  );
}

function FieldMenu({
  field,
  onChange,
  singleChoice,
}: {
  field: FilterField;
  onChange: (optionId: string) => void;
  singleChoice: string;
}) {
  const active = isFieldActive(field);
  const current = field.options.find((option) => option.id === field.value);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-field-id={field.id}
          data-active={active ? true : undefined}
          className={cn(
            'inline-flex h-(--bp-size-control) max-w-full items-center gap-1 rounded-control border px-2 font-body text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring in-data-compact:h-7 in-data-compact:text-xs',
            active
              ? 'border-accent bg-row-accent font-medium text-accent'
              : 'border-border-strong bg-control text-default hover:bg-sunken',
          )}
        >
          <span className="text-subtle">{field.label}</span>
          <span className="truncate">{current?.label ?? field.value}</span>
          <ChevronDown aria-hidden className="size-3 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <OptionList field={field} onChange={onChange} singleChoice={singleChoice} />
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FilterBar({ fields, onChange, onClearAll, compact = false, ...rest }: FilterBarProps) {
  const labels = useLabels(rest.labels);
  const anyActive = fields.some((field) => isFieldActive(field));

  return (
    <div
      role="group"
      aria-label={labels.panel.filtersLabel}
      data-compact={compact ? true : undefined}
      className="flex flex-wrap items-center gap-1.5"
    >
      {fields.map((field) => (
        <FieldMenu
          key={field.id}
          field={field}
          onChange={(optionId) => onChange(field.id, optionId)}
          singleChoice={labels.panel.singleChoice}
        />
      ))}
      <Button
        variant="ghost"
        onClick={onClearAll}
        disabled={!anyActive}
        className="ml-auto h-(--bp-size-control) px-2 text-sm in-data-compact:h-7 in-data-compact:text-xs"
      >
        <X aria-hidden className="size-3" />
        {labels.panel.clearFilters}
      </Button>
    </div>
  );
}
