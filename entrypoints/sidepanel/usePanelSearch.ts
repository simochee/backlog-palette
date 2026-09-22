import { useCallback, useEffect, useRef, useState } from 'react';

import {
  arrive,
  endedOffline,
  fail,
  resultRowId,
  type SearchSession,
  startSession,
} from '@/lib/search';
import { type SearchState, searchState } from '@/lib/share';
import { track } from '@/lib/telemetry/track';

import { recordSearch } from './context.ts';
import type { PanelSearchRunner } from './runner.ts';
import { canRun, type PanelSearch } from './searchParams.ts';

/** attempt は同じ検索を接続の回復で引き直した回数。0 回目だけが利用者の検索（D-58） */
type Store = { searchKey: string; attempt: number; session: SearchSession | undefined };

const noop = () => {};

function freshStore(search: PanelSearch, searchKey: string, attempt: number): Store {
  return {
    searchKey,
    attempt,
    session: canRun(search) ? startSession(search.query, search.scope) : undefined,
  };
}

function useRetryWhenOnline(offline: boolean, retry: () => void) {
  useEffect(() => {
    if (!offline) return noop;
    window.addEventListener('online', retry);
    return () => {
      window.removeEventListener('online', retry);
    };
  }, [offline, retry]);
}

/**
 * URL の検索状態が変わるたびに検索を走らせ直す。到着は種別ごとに合流し、選択行より上に
 * 入る行は保留する（I4）。入力の途中では走らせない（Enter で明示的に起動、D-2）。
 * オフラインで終わった検索は、接続が戻ったら引き直す（palette.md §7.5、D-58）。
 *
 * effect は runner の起動と打ち切りだけを持ち、状態は到着の callback（非同期）でしか変えない
 */
export function usePanelSearch(
  search: PanelSearch,
  runner: PanelSearchRunner,
  selectedId: string | undefined,
  learningEnabled: boolean,
) {
  const searchKey = JSON.stringify(search);
  const [store, setStore] = useState<Store>(() => freshStore(search, searchKey, 0));
  // 検索が変わったら試行回数ごと作り直す。残すと、同じ検索に戻ったとき利用者の検索が数えられない
  if (store.searchKey !== searchKey) setStore(freshStore(search, searchKey, 0));
  const { attempt, session } =
    store.searchKey === searchKey ? store : freshStore(search, searchKey, 0);
  const selected = useRef(selectedId);

  useEffect(() => {
    selected.current = selectedId;
  }, [selectedId]);

  /*
   * 引き直しは新しいセッションから始める。失敗したセッションに到着を重ねると、先に
   * 揃っていた種別の行が二重に入る
   */
  const retry = useCallback(() => {
    setStore((previous) =>
      previous.searchKey === searchKey
        ? freshStore(search, searchKey, previous.attempt + 1)
        : previous,
    );
  }, [search, searchKey]);
  useRetryWhenOnline(endedOffline(session), retry);

  useEffect(() => {
    if (!canRun(search)) return noop;
    const { query, scope, conditions } = search;
    if (attempt === 0) {
      if (learningEnabled) void recordSearch(query, scope, Date.now());
      track({ type: 'panelSearchStarted' });
    }
    const cancel = runner.run(
      query,
      scope,
      (kind, outcome) => {
        setStore((previous) => {
          const base = previous.session;
          if (previous.searchKey !== searchKey || previous.attempt !== attempt) return previous;
          if (base === undefined) return previous;
          if (!outcome.ok) return { ...previous, session: fail(base, kind, outcome.error) };
          const index = base.rows.findIndex((row) => resultRowId(row) === selected.current);
          return {
            ...previous,
            session: arrive(base, kind, outcome.rows, index === -1 ? undefined : index),
          };
        });
      },
      conditions,
    );
    // 入力が変わったら走っている検索を捨てる（palette.md §7.4）
    return cancel;
  }, [search, searchKey, attempt, runner, learningEnabled]);

  const state = useCallback((): SearchState | undefined => {
    if (search.scope === undefined) return undefined;
    return searchState(search.query, search.scope, search.conditions);
  }, [search]);

  return { session, state };
}
