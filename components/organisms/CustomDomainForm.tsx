import { useForm } from '@tanstack/react-form';
import { X } from 'lucide-react';

import { Button } from '@/components/atoms/Button';
import { type Labels, useLabels } from '@/components/labels';

type CustomDomainFormProps = {
  hosts: readonly string[];
  onAdd: (host: string) => void;
  onRemove?: (host: string) => void;
  initialValue?: string;
  labels?: Partial<Labels>;
};

const hostLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

/** スキームやパスを含まないホスト名だけを受ける。実際の形式は未確認なので 1 ホスト単位で扱う（surfaces.md §8） */
export function isValidHost(value: string): boolean {
  const labelsOfHost = value.trim().split('.');
  return labelsOfHost.length >= 2 && labelsOfHost.every((part) => hostLabel.test(part));
}

function HostList({
  hosts,
  onRemove,
  labels,
}: {
  hosts: readonly string[];
  onRemove?: (host: string) => void;
  labels: Labels;
}) {
  if (hosts.length === 0)
    return <p className="text-sm text-subtle">{labels.options.customDomain.empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {hosts.map((host) => (
        <li
          key={host}
          className="flex items-center justify-between gap-2 rounded-control bg-sunken px-2 py-1 font-mono text-sm"
        >
          <span className="truncate">{host}</span>
          {onRemove !== undefined && (
            <Button
              variant="ghost"
              onClick={() => onRemove(host)}
              aria-label={`${labels.options.customDomain.remove}: ${host}`}
              className="h-6 px-1"
            >
              <X aria-hidden className="size-3" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

type HostFieldProps = {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
  labels: Labels;
};

function HostField({ value, error, onChange, onBlur, labels }: HostFieldProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="url"
          aria-label={labels.options.customDomain.inputLabel}
          aria-invalid={error === undefined ? undefined : true}
          placeholder={labels.options.customDomain.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className="h-(--bp-size-control) min-w-0 flex-1 rounded-control border border-border-strong bg-control px-2 font-mono text-md text-default outline-none placeholder:text-disabled focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger"
        />
        <Button type="submit" variant="secondary" disabled={!isValidHost(value)}>
          {labels.options.customDomain.add}
        </Button>
      </div>
      {error !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}

export function CustomDomainForm({
  hosts,
  onAdd,
  onRemove,
  initialValue = '',
  ...rest
}: CustomDomainFormProps) {
  const labels = useLabels(rest.labels);
  const form = useForm({
    defaultValues: { host: initialValue },
    onSubmit: ({ value }) => {
      onAdd(value.host.trim());
      form.reset();
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="host"
          validators={{
            onChange: ({ value }) =>
              value.trim() === '' || isValidHost(value)
                ? undefined
                : labels.options.customDomain.invalid,
          }}
        >
          {(field) => (
            <HostField
              value={field.state.value}
              error={field.state.meta.errors.find((message) => typeof message === 'string')}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              labels={labels}
            />
          )}
        </form.Field>
      </form>
      <HostList hosts={hosts} onRemove={onRemove} labels={labels} />
    </div>
  );
}
