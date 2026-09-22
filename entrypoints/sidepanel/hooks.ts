import { useLiveSuspenseQuery } from '@tanstack/react-db';
import { useEffect, useState } from 'react';

import type { ToastView } from '@/components/types';
import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';
import { collections } from '@/lib/storage';
import { openPaletteInCurrentTab } from '@/lib/tabs';

import { recentQueriesFor } from './context.ts';
import type { PanelSearch } from './searchParams.ts';

const TOAST_LIFETIME_MS = 2000;

/** パネルに 1 つ。検索の記録（recordSearch）は item に書き、ここは watch で追う */
const searchHistory = collections.searchHistory();

export function useRecentQueries(scope: PanelSearch['scope']): string[] {
  const { data } = useLiveSuspenseQuery((q) =>
    q.from({ record: searchHistory }).orderBy(({ record }) => record.at, 'desc'),
  );
  return recentQueriesFor(data, scope);
}

export function useToast(): [ToastView | undefined, (toast: ToastView) => void] {
  const [toast, setToast] = useState<ToastView>();
  useEffect(() => {
    const timer =
      toast === undefined ? undefined : setTimeout(() => setToast(undefined), TOAST_LIFETIME_MS);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [toast]);
  return [toast, setToast];
}

/** パネルの ⌘K はタブのパレットを開く（surfaces.md §5.4、P1）。パネル内のフォーカス移動には使わない */
export function usePaletteHotkey() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || !isPaletteHotkey(event, navigator.platform)) return;
      event.preventDefault();
      void openPaletteInCurrentTab();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);
}
