import { KeyHints } from '@/components/molecules/KeyHints';
import { Toast } from '@/components/molecules/Toast';
import type { KeyHint, ToastView } from '@/components/types';

type PaletteFooterProps = {
  hints: readonly KeyHint[];
  toast?: ToastView;
  brand: string;
};

export function PaletteFooter({ hints, toast, brand }: PaletteFooterProps) {
  return (
    <div className="flex h-full items-center gap-3 px-3">
      <KeyHints hints={hints} />
      <div className="max-w-1/2 shrink-0">
        {toast ? <Toast toast={toast} /> : <span className="text-xs text-disabled">{brand}</span>}
      </div>
    </div>
  );
}
