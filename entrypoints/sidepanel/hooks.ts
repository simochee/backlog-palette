import { useEffect, useMemo, useState } from 'react';

import type { ToastView } from '@/components/types';
import { searchHistory } from '@/lib/storage/palette-items';

import { type PanelContext, readPanelContext, recentQueriesFor } from './context.ts';
import type { PanelSearch } from './searchParams.ts';

const TOAST_LIFETIME_MS = 2000;

export function usePanelContext(): PanelContext | undefined {
  const [context, setContext] = useState<PanelContext>();
  useEffect(() => {
    void readPanelContext().then(setContext);
  }, []);
  return context;
}

export function useRecentQueries(scope: PanelSearch['scope']): string[] {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof searchHistory.getValue>>>([]);
  useEffect(() => {
    void searchHistory.getValue().then(setHistory);
    return searchHistory.watch((next) => {
      setHistory(next);
    });
  }, []);
  return useMemo(() => recentQueriesFor(history, scope), [history, scope]);
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
