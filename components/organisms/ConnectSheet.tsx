import { useForm } from '@tanstack/react-form';
import { CircleCheck, KeyRound } from 'lucide-react';
import { type KeyboardEvent, type RefObject, useEffect, useRef } from 'react';

import { Button } from '@/components/atoms/Button';
import { type Labels, useLabels } from '@/components/labels';
import type { ConnectSheetState } from '@/components/types';

type ConnectSheetProps = {
  state: ConnectSheetState;
  onSubmit: (apiKey: string) => void;
  onClose: () => void;
  labels?: Partial<Labels>;
};

/** Enter は自前で送信する。変換中の Enter（I5）を捨て、空と二重送信を止めるため */
function useApiKeyForm(onSubmit: (apiKey: string) => void, submitting: boolean) {
  const form = useForm({
    defaultValues: { apiKey: '' },
    onSubmit: ({ value }) => onSubmit(value.apiKey.trim()),
  });
  const submit = () => {
    if (submitting || form.state.values.apiKey.trim() === '') return;
    void form.handleSubmit();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (event.nativeEvent.isComposing) return;
    submit();
  };
  return { form, submit, handleKeyDown };
}

function DoneBar({
  spaceLabel,
  onClose,
  labels,
}: {
  spaceLabel: string;
  onClose: () => void;
  labels: Labels;
}) {
  return (
    <>
      <CircleCheck aria-hidden className="size-(--bp-size-icon) shrink-0 text-marker-success-dot" />
      <p className="min-w-0 flex-1 truncate text-md font-medium">
        {labels.connect.doneTitle(spaceLabel)}
      </p>
      <Button variant="secondary" shape="pill" onClick={onClose}>
        {labels.connect.close}
      </Button>
    </>
  );
}

type ApiKeyInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  invalid: boolean;
  disabled: boolean;
  labels: Labels;
};

function ApiKeyInput({
  inputRef,
  value,
  onChange,
  onBlur,
  onKeyDown,
  invalid,
  disabled,
  labels,
}: ApiKeyInputProps) {
  return (
    <input
      ref={inputRef}
      type="password"
      aria-label={labels.connect.inputLabel}
      aria-invalid={invalid ? true : undefined}
      placeholder={labels.connect.placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-(--bp-size-control) min-w-0 flex-1 bg-transparent font-mono text-md text-default outline-none placeholder:text-subtle"
    />
  );
}

function ConnectForm({
  state,
  onSubmit,
  labels,
}: Omit<ConnectSheetProps, 'onClose' | 'labels'> & { labels: Labels }) {
  const submitting = state.kind === 'submitting';
  const { form, submit, handleKeyDown } = useApiKeyForm(onSubmit, submitting);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <KeyRound aria-hidden className="size-(--bp-size-icon) shrink-0 text-subtle" />
      <form.Field name="apiKey">
        {(field) => (
          <ApiKeyInput
            inputRef={inputRef}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            onKeyDown={handleKeyDown}
            invalid={state.kind === 'error'}
            disabled={submitting}
            labels={labels}
          />
        )}
      </form.Field>
      {state.kind === 'error' && (
        <p role="alert" className="shrink-0 text-sm text-danger">
          {state.message}
        </p>
      )}
      <form.Subscribe selector={(formState) => formState.values.apiKey.trim() === ''}>
        {(empty) => (
          <Button type="submit" shape="pill" busy={submitting} disabled={empty}>
            {submitting ? labels.connect.submitting : labels.connect.submit}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/** 画面下部中央に出す横長のバー。パレットから遷移してくるので説明は置かず、入力欄とボタンだけ（surfaces.md §1.2） */
export function ConnectSheet({ state, onSubmit, onClose, ...rest }: ConnectSheetProps) {
  const labels = useLabels(rest.labels);
  return (
    <section
      aria-label={labels.connect.title}
      data-state={state.kind}
      className="flex w-full max-w-(--bp-width-sheet) items-center gap-3 rounded-pill border border-border bg-floating py-1.5 pr-1.5 pl-4 font-body text-default shadow-floating data-[state=error]:border-danger"
    >
      {state.kind === 'done' ? (
        <DoneBar spaceLabel={state.spaceLabel} onClose={onClose} labels={labels} />
      ) : (
        <ConnectForm state={state} onSubmit={onSubmit} labels={labels} />
      )}
    </section>
  );
}
