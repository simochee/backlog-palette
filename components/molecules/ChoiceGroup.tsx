import { RadioGroup } from 'radix-ui';

export type Choice<T extends string = string> = { id: T; label: string };

type ChoiceGroupProps<T extends string> = {
  /** グループの読み上げ名。SettingRow の label と同じ語を渡す */
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

/**
 * 設定画面の「1 つだけ選ぶ」コントロール（配色・言語、surfaces.md §2）。
 * 横に並べ、選択肢が少ないときに <select> を開く手間を省く。Radix の RadioGroup（D-17）。
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: ChoiceGroupProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.id === next);
        if (chosen !== undefined) onChange(chosen.id);
      }}
      aria-label={label}
      disabled={disabled}
      className="flex flex-wrap items-center gap-1 rounded-control border border-border-strong bg-control p-0.5"
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.id}
          value={option.id}
          className="h-[calc(var(--bp-size-control)-6px)] rounded-inner px-2 text-sm text-subtle outline-none hover:bg-sunken focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-floating data-[state=checked]:text-default data-[state=checked]:shadow-floating"
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
