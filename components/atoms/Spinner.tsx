import { LoaderCircle } from 'lucide-react';

import { cn } from '@/components/utils/cn';

type SpinnerProps = {
  label?: string;
  className?: string;
};

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <LoaderCircle
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'size-(--bp-size-icon) shrink-0 animate-spin text-subtle motion-reduce:animate-none',
        className,
      )}
    />
  );
}
