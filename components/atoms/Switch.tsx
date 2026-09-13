import { Switch as RadixSwitch } from 'radix-ui';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export function Switch({ checked, onCheckedChange, disabled = false, ...aria }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-pill border border-border-strong bg-control p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      {...aria}
    >
      <RadixSwitch.Thumb className="block size-3.5 rounded-pill bg-floating shadow-floating transition-transform data-[state=checked]:translate-x-4" />
    </RadixSwitch.Root>
  );
}
