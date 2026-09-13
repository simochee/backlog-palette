import { Badge } from '@/components/atoms/Badge';
import { Kbd } from '@/components/atoms/Kbd';
import { KindIcon } from '@/components/atoms/KindIcon';
import { SpaceBadge } from '@/components/atoms/SpaceBadge';
import { Spinner } from '@/components/atoms/Spinner';
import type { RowHint, RowTone, RowView } from '@/components/types';
import { cn } from '@/components/utils/cn';

type ResultRowProps = {
  row: RowView;
  selected: boolean;
  optionId: string;
  onClick?: () => void;
};

/** 行末に描くキー記号。modEnter はフッターだけに出す */
const hintSymbols: Partial<Record<RowHint, string>> = {
  enter: '↵',
  descend: '›',
  complete: '⇥',
  stack: '⇥',
};

const surface: Record<RowTone, (selected: boolean) => string> = {
  default: (selected) => (selected ? 'bg-row-selected' : ''),
  accent: () => 'bg-row-accent',
  danger: () => 'bg-row-danger',
};

export function ResultRow({ row, selected, optionId, onClick }: ResultRowProps) {
  const tone = row.tone ?? 'default';
  const symbols = row.hints
    .map((hint) => hintSymbols[hint])
    .filter((symbol): symbol is string => symbol !== undefined)
    .filter((symbol, index, all) => all.indexOf(symbol) === index);

  return (
    <div
      role="option"
      id={optionId}
      aria-selected={selected}
      data-row-id={row.id}
      data-kind={row.kind}
      data-tone={tone}
      data-selected={selected}
      onClick={onClick}
      className={cn(
        'group/row relative flex min-h-(--bp-size-row) cursor-default items-center gap-2 px-3 py-1.5 text-md text-default',
        'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-pill before:bg-accent before:opacity-0',
        selected && 'before:opacity-100',
        surface[tone](selected),
      )}
    >
      {row.busy ? <Spinner /> : <KindIcon kind={row.kind} className="text-subtle" />}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {row.tag && <Badge label={row.tag.label} tone={row.tag.tone} />}
          {row.code && <span className="shrink-0 font-mono text-sm text-subtle">{row.code}</span>}
          <span
            title={row.title}
            className={cn(
              'truncate',
              selected && 'font-semibold',
              tone === 'danger' && 'text-danger',
              row.kind === 'hint' && 'text-subtle',
            )}
          >
            {row.title}
          </span>
        </div>
        {(row.sub || row.marker) && (
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-subtle">
            {row.marker && <Badge label={row.marker.label} tone={row.marker.tone} dot />}
            {row.sub && <span className="truncate @max-narrow:hidden">{row.sub}</span>}
          </div>
        )}
      </div>

      {row.space && <SpaceBadge label={row.space.label} />}

      {symbols.length > 0 && (
        <span className={cn('flex shrink-0 gap-1', !selected && 'opacity-50')}>
          {symbols.map((symbol) => (
            <Kbd key={symbol} keys={[symbol]} />
          ))}
        </span>
      )}
    </div>
  );
}
