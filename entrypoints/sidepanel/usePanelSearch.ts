import { useEffect, useEffectEvent, useState } from 'react';

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

/** attempt は同じ検索を接続の回復で引き直した回数。0 回目だけが利用者の検索（D-59） */
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
  const onOnline = useEffectEvent(retry);
  useEffect(() => {
    if (!offline) return noop;
    const listener = () => onOnline();
    window.addEventListener('online', listener);
    return () => {
      window.removeEventListener('online', listener);
    };
  }, [offline]);
}

/*
 * 検索が変わったら試行回数ごと作り直す。残すと、同じ検索に戻ったとき利用者の検索が数えられない。
 * 引き直しも新しいセッションから始める。失敗したセッションに到着を重ねると、先に揃っていた
 * 種別の行が二重に入る
 */
function useSearchStore(search: PanelSearch) {
  const searchKey = JSON.stringify(search);
  const [store, setStore] = useState<Store>(() => freshStore(search, searchKey, 0));
  if (store.searchKey !== searchKey) setStore(freshStore(search, searchKey, 0));
  const current = store.searchKey === searchKey ? store : freshStore(search, searchKey, 0);

  useRetryWhenOnline(endedOffline(current.session), () => {
    setStore((previous) =>
      previous.searchKey === searchKey
        ? freshStore(search, searchKey, previous.attempt + 1)
        : previous,
    );
  });

  return { searchKey, attempt: current.attempt, session: current.session, setStore };
}

/**
 * URL の検索状態が変わるたびに検索を走らせ直す。到着は種別ごとに合流し、選択行より上に
 * 入る行は保留する（I4）。入力の途中では走らせない（Enter で明示的に起動、D-2）。
 * オフラインで終わった検索は、接続が戻ったら引き直す（palette.md §7.5、D-59）。
 *
 * effect は検索の同一性（searchKey と試行回数）だけに反応し、runner の起動と打ち切りを持つ。
 * 状態は到着の callback（非同期）でしか変えない
 */
export function usePanelSearch(
  search: PanelSearch,
  runner: PanelSearchRunner,
  selectedId: string | undefined,
  learningEnabled: boolean,
) {
  const { searchKey, attempt, session, setStore } = useSearchStore(search);
  const currentSelection = useEffectEvent(() => selectedId);

  const start = useEffectEvent((key: string, run: number) => {
    if (!canRun(search)) return noop;
    const { query, scope, conditions } = search;
    if (run === 0) {
      if (learningEnabled) void recordSearch(query, scope, Date.now());
      track({ type: 'panelSearchStarted' });
    }
    return runner.run(
      query,
      scope,
      (kind, outcome) => {
        const selected = currentSelection();
        setStore((previous) => {
          const base = previous.session;
          if (previous.searchKey !== key || previous.attempt !== run) return previous;
          if (base === undefined) return previous;
          if (!outcome.ok) return { ...previous, session: fail(base, kind, outcome.error) };
          const index = base.rows.findIndex((row) => resultRowId(row) === selected);
          return {
            ...previous,
            session: arrive(base, kind, outcome.rows, index === -1 ? undefined : index),
          };
        });
      },
      conditions,
    );
  });

  // 入力が変わったら走っている検索を捨てる（palette.md §7.4）。戻り値の cancel がそれ
  useEffect(() => start(searchKey, attempt), [searchKey, attempt]);

  const state = (): SearchState | undefined => {
    if (search.scope === undefined) return undefined;
    return searchState(search.query, search.scope, search.conditions);
  };

  return { session, state };
}
