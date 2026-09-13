import type { ReactNode } from 'react';

type SettingRowProps = {
  label: string;
  description?: string;
  control: ReactNode;
  htmlFor?: string;
};

export function SettingRow({ label, description, control, htmlFor }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-md font-medium text-default">
          {label}
        </label>
        {description !== undefined && <p className="mt-0.5 text-sm text-subtle">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center">{control}</div>
    </div>
  );
}
