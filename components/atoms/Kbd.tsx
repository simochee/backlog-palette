import { cn } from '@/components/utils/cn';

type KbdProps = {
  keys: readonly string[];
  dim?: boolean;
};

export function Kbd({ keys, dim = false }: KbdProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', dim && 'opacity-60')}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-control border border-kbd-border bg-kbd-bg px-1 font-body text-xs leading-none text-kbd-text"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
