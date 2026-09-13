type SectionHeaderProps = {
  id: string;
  label: string;
  meta?: string;
};

export function SectionHeader({ id, label, meta }: SectionHeaderProps) {
  return (
    <div
      id={id}
      role="presentation"
      className="flex items-baseline justify-between gap-2 px-3 pt-2 pb-1 text-xs text-subtle"
    >
      <span className="font-semibold">{label}</span>
      {meta !== undefined && <span className="truncate">{meta}</span>}
    </div>
  );
}
