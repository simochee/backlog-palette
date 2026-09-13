import { LoaderCircle } from 'lucide-react';

import { cn } from '@/components/utils/cn';

type SpinnerProps = {
  label?: string;
  className?: string;
};

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <LoaderCircle
      role={label === undefined ? undefined : 'status'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={cn('size-(--bp-size-icon) shrink-0 animate-spin text-subtle', className)}
    />
  );
}
