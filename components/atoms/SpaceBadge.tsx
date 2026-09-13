type SpaceBadgeProps = {
  label: string;
};

const asciiWord = /^[\x20-\x7E]+$/u;

export function initialsOf(label: string): { first: string; second?: string } {
  const chars = Array.from(label.trim());
  const first = chars[0] ?? '';
  if (!asciiWord.test(label)) return { first };
  const second = chars[1];
  return {
    first: first.toUpperCase(),
    second: second === undefined ? undefined : second.toUpperCase(),
  };
}

export function SpaceBadge({ label }: SpaceBadgeProps) {
  const { first, second } = initialsOf(label);
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-control border border-border bg-sunken px-1 font-mono text-xs font-semibold leading-none text-subtle"
    >
      <span aria-hidden>{first}</span>
      {second && (
        <span aria-hidden className="@max-narrow:hidden">
          {second}
        </span>
      )}
    </span>
  );
}
