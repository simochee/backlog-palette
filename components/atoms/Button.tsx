import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from '@/components/atoms/Spinner';
import { cn } from '@/components/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type ButtonTone = 'default' | 'danger';
type Shape = 'control' | 'pill';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  tone?: ButtonTone;
  /** pill の容れ物（接続バーなど）の中では pill にして角丸を同心円に揃える */
  shape?: Shape;
  busy?: boolean;
  children: ReactNode;
};

const styles: Record<ButtonTone, Record<Variant, string>> = {
  default: {
    primary: 'bg-accent text-accent-text hover:bg-accent-strong',
    secondary: 'border border-border-strong bg-control text-default hover:bg-sunken',
    ghost: 'text-accent hover:bg-sunken',
  },
  danger: {
    primary: 'bg-danger text-danger-text hover:opacity-90',
    secondary: 'border border-border-strong bg-control text-danger hover:bg-row-danger',
    ghost: 'text-danger hover:bg-row-danger',
  },
};

export function Button({
  variant = 'primary',
  tone = 'default',
  shape = 'control',
  busy = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-tone={tone}
      data-shape={shape}
      aria-busy={busy ? true : undefined}
      disabled={disabled === true || busy}
      className={cn(
        'inline-flex h-(--bp-size-control) items-center justify-center gap-1.5 px-3 font-body text-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        shape === 'pill' ? 'rounded-pill px-4' : 'rounded-control',
        styles[tone][variant],
        className,
      )}
      {...props}
    >
      {busy && <Spinner className="text-current" />}
      {children}
    </button>
  );
}
