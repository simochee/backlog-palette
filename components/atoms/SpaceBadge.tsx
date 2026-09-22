type SpaceBadgeProps = {
  label: string;
  icon?: string;
};

const asciiWord = /^[\u0020-\u007E]+$/u;

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

/** スペースのアイコン画像があれば画像、無ければ頭文字。ラベルは表示名（キーではない） */
export function SpaceBadge({ label, icon }: SpaceBadgeProps) {
  if (icon !== undefined) {
    return (
      <img
        src={icon}
        alt={label}
        title={label}
        className="size-5 shrink-0 rounded-control border border-border object-cover"
      />
    );
  }

  const { first, second } = initialsOf(label);
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-control bg-marker-neutral-bg px-1 font-mono text-xs font-semibold leading-none text-marker-neutral-fg"
    >
      <span aria-hidden>{first}</span>
      {second !== undefined && (
        <span aria-hidden className="@max-narrow:hidden">
          {second}
        </span>
      )}
    </span>
  );
}
