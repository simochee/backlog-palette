import { useForm } from '@tanstack/react-form';
import { CircleCheck } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef } from 'react';

import { Button } from '@/components/atoms/Button';
import { type Labels, useLabels } from '@/components/labels';
import type { ConnectSheetState } from '@/components/types';

type ConnectSheetProps = {
  state: ConnectSheetState;
  onSubmit: (apiKey: string) => void;
  onOAuth: () => void;
  onClose: () => void;
  labels?: Partial<Labels>;
};

function DoneView({
  spaceLabel,
  onClose,
  labels,
}: {
  spaceLabel: string;
  onClose: () => void;
  labels: Labels;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CircleCheck aria-hidden className="size-5 text-marker-success-dot" />
        {labels.connect.doneTitle(spaceLabel)}
      </h2>
      <p className="text-sm text-subtle">{labels.connect.doneHint}</p>
      <Button variant="secondary" onClick={onClose}>
        {labels.connect.close}
      </Button>
    </div>
  );
}

type ApiKeyFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  state: ConnectSheetState;
  disabled: boolean;
  labels: Labels;
};

function ApiKeyField({
  value,
  onChange,
  onBlur,
  onKeyDown,
  state,
  disabled,
  labels,
}: ApiKeyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="password"
        aria-label={labels.connect.inputLabel}
        aria-invalid={state.kind === 'error' ? true : undefined}
        placeholder={labels.connect.placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="h-(--bp-size-control) rounded-control border border-border-strong bg-control px-2 font-mono text-md text-default outline-none placeholder:text-disabled focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger"
      />
      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}

/** Enter は自前で送信する。変換中の Enter（I5）を捨て、二重送信を避けるため */
function useApiKeyForm(onSubmit: (apiKey: string) => void, submitting: boolean) {
  const form = useForm({
    defaultValues: { apiKey: '' },
    onSubmit: ({ value }) => onSubmit(value.apiKey.trim()),
  });
  const submit = () => {
    if (form.state.values.apiKey.trim() === '') return;
    void form.handleSubmit();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (event.nativeEvent.isComposing || submitting) return;
    submit();
  };
  return { form, submit, handleKeyDown };
}

function Intro({ labels }: { labels: Labels }) {
  return (
    <>
      <h2 className="text-lg font-semibold">{labels.connect.title}</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-subtle">
        {labels.connect.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </>
  );
}

function ConnectForm({
  state,
  onSubmit,
  onOAuth,
  labels,
}: Omit<ConnectSheetProps, 'onClose' | 'labels'> & { labels: Labels }) {
  const submitting = state.kind === 'submitting';
  const { form, submit, handleKeyDown } = useApiKeyForm(onSubmit, submitting);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Intro labels={labels} />
      <form.Field name="apiKey">
        {(field) => (
          <ApiKeyField
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            onKeyDown={handleKeyDown}
            state={state}
            disabled={submitting}
            labels={labels}
          />
        )}
      </form.Field>
      <div className="flex flex-wrap items-center gap-2">
        <form.Subscribe selector={(formState) => formState.values.apiKey.trim() === ''}>
          {(empty) => (
            <Button type="submit" busy={submitting} disabled={empty}>
              {submitting ? labels.connect.submitting : labels.connect.submit}
            </Button>
          )}
        </form.Subscribe>
        <Button variant="ghost" onClick={onOAuth} disabled={submitting}>
          {labels.connect.oauth}
        </Button>
      </div>
      <p className="text-xs text-subtle">{labels.connect.note}</p>
    </form>
  );
}

export function ConnectSheet({ state, onSubmit, onOAuth, onClose, ...rest }: ConnectSheetProps) {
  const labels = useLabels(rest.labels);
  return (
    <section
      aria-label={labels.connect.title}
      className="w-full max-w-(--bp-width-sheet) rounded-surface border border-border bg-floating p-5 font-body text-default shadow-floating"
    >
      {state.kind === 'done' ? (
        <DoneView spaceLabel={state.spaceLabel} onClose={onClose} labels={labels} />
      ) : (
        <ConnectForm state={state} onSubmit={onSubmit} onOAuth={onOAuth} labels={labels} />
      )}
    </section>
  );
}
