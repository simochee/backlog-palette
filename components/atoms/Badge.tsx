import type { Tone } from '@/components/types';
import { cn } from '@/components/utils/cn';

type BadgeProps = {
  label: string;
  tone: Tone;
  dot?: boolean;
};

const surface: Record<Tone, string> = {
  neutral: 'bg-marker-neutral-bg text-marker-neutral-fg',
  info: 'bg-marker-info-bg text-marker-info-fg',
  success: 'bg-marker-success-bg text-marker-success-fg',
  done: 'bg-marker-done-bg text-marker-done-fg',
  warning: 'bg-marker-warning-bg text-marker-warning-fg',
  danger: 'bg-marker-danger-bg text-marker-danger-fg',
};

const dotColor: Record<Tone, string> = {
  neutral: 'bg-marker-neutral-dot',
  info: 'bg-marker-info-dot',
  success: 'bg-marker-success-dot',
  done: 'bg-marker-done-dot',
  warning: 'bg-marker-warning-dot',
  danger: 'bg-marker-danger-dot',
};

export function Badge({ label, tone, dot = false }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex h-4.5 shrink-0 items-center gap-1 rounded-pill px-1.5 text-xs font-medium whitespace-nowrap leading-none',
        surface[tone],
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-pill', dotColor[tone])} />}
      {label}
    </span>
  );
}
