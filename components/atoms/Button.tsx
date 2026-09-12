import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
};

export function Button({ variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button data-variant={variant} {...props}>
      {children}
    </button>
  );
}
