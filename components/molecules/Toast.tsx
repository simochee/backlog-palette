import type { ToastView } from '@/components/types';

type ToastProps = {
  toast: ToastView;
};

export function Toast({ toast }: ToastProps) {
  return (
    <div
      role="status"
      className="flex min-w-0 items-baseline gap-1.5 text-xs text-default"
      title={toast.detail ? `${toast.message} ${toast.detail}` : toast.message}
    >
      <span className="truncate font-medium">{toast.message}</span>
      {toast.detail && <span className="truncate font-mono text-subtle">{toast.detail}</span>}
    </div>
  );
}
