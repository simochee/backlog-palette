import { SpaceBadge } from '@/components/atoms/SpaceBadge';
import type { PathSegmentView } from '@/components/types';
import { cn } from '@/components/utils/cn';

type ScopePathProps = {
  segments: readonly PathSegmentView[];
};

export function ScopePath({ segments }: ScopePathProps) {
  if (segments.length === 0) return null;

  return (
    <ol className="flex min-w-0 shrink-0 items-center gap-1 text-sm text-subtle">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <li
            key={segment.id}
            data-armed={segment.armed === true ? true : undefined}
            className={cn(
              'flex items-center gap-1 whitespace-nowrap',
              segment.armed === true && 'text-warning',
            )}
          >
            {segment.badge === true && <SpaceBadge label={segment.label} icon={segment.icon} />}
            <span
              className={cn(
                'max-w-40 truncate',
                segment.armed === true && 'line-through decoration-2',
                segment.compact === true && 'hidden',
                !isLast && segment.compact !== true && '@max-compact:hidden',
              )}
            >
              {segment.label}
            </span>
            <span aria-hidden className="text-disabled no-underline">
              /
            </span>
          </li>
        );
      })}
    </ol>
  );
}
