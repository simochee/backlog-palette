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
  default: (selected) => (selected ? 'bg-row-selected' : 'hover:bg-sunken'),
  accent: (selected) => (selected ? 'bg-row-accent' : 'bg-row-accent hover:brightness-95'),
  danger: (selected) => (selected ? 'bg-row-danger' : 'bg-row-danger hover:brightness-95'),
};

function RowBody({ row, selected, tone }: { row: RowView; selected: boolean; tone: RowTone }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {row.tag !== undefined && <Badge label={row.tag.label} tone={row.tag.tone} />}
        {row.code !== undefined && (
          <span className="shrink-0 font-mono text-sm text-subtle">{row.code}</span>
        )}
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
      {(row.sub !== undefined || row.marker !== undefined) && (
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-subtle">
          {row.marker !== undefined && (
            <Badge label={row.marker.label} tone={row.marker.tone} dot />
          )}
          {row.sub !== undefined && <span className="truncate @max-narrow:hidden">{row.sub}</span>}
        </div>
      )}
    </div>
  );
}

function RowHints({ hints, selected }: { hints: readonly RowHint[]; selected: boolean }) {
  const symbols = hints
    .map((hint) => hintSymbols[hint])
    .filter((symbol): symbol is string => symbol !== undefined)
    .filter((symbol, index, all) => all.indexOf(symbol) === index);
  if (symbols.length === 0) return null;

  return (
    <span className={cn('flex shrink-0 gap-1', !selected && 'opacity-50')}>
      {symbols.map((symbol) => (
        <Kbd key={symbol} keys={[symbol]} />
      ))}
    </span>
  );
}

export function ResultRow({ row, selected, optionId, onClick }: ResultRowProps) {
  const tone = row.tone ?? 'default';

  return (
    // キーは Palette が入力欄で受ける（仮想フォーカス）。行はクリックだけを扱い、
    // tabIndex=-1 でフォーカス可能にしつつ Tab の巡回には入れない。
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      role="option"
      id={optionId}
      tabIndex={-1}
      aria-selected={selected}
      data-row-id={row.id}
      data-kind={row.kind}
      data-tone={tone}
      data-selected={selected}
      onClick={onClick}
      className={cn(
        'group/row relative flex min-h-(--bp-size-row) cursor-default items-center gap-2 px-3 py-1.5 text-md text-default outline-none',
        'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-pill before:bg-accent before:opacity-0',
        selected && 'before:opacity-100',
        surface[tone](selected),
      )}
    >
      {row.busy === true ? <Spinner /> : <KindIcon kind={row.kind} className="text-subtle" />}
      <RowBody row={row} selected={selected} tone={tone} />
      {row.space !== undefined && <SpaceBadge label={row.space.label} icon={row.space.icon} />}
      <RowHints hints={row.hints} selected={selected} />
    </div>
  );
}
