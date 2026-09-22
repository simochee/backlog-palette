import { useCallback, useEffect, useRef, useState } from 'react';

import { arrive, errorOf, fail, resultRowId, type SearchSession, startSession } from '@/lib/search';
import { type SearchState, searchState } from '@/lib/share';
import { track } from '@/lib/telemetry/track';

import { recordSearch } from './context.ts';
import type { PanelSearchRunner } from './runner.ts';
import { canRun, type PanelSearch } from './searchParams.ts';

type Store = { key: string; session: SearchSession | undefined };

type Retried = { searchKey: string; attempt: number };
const noop = () => {};

function initialSession(search: PanelSearch): SearchSession | undefined {
  return canRun(search) ? startSession(search.query, search.scope) : undefined;
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

/*
 * 接続が戻ったら引き直す（palette.md §7.5、D-58）。試行回数をキーに混ぜて新しい
 * セッションから始める。失敗したセッションに到着を重ねると、先に揃っていた種別の
 * 行が二重に入る。試行回数は検索ごとに数え、0 回目だけを利用者の検索として記録する
 */
function useAttempt(searchKey: string, session: SearchSession | undefined): number {
  const [retried, setRetried] = useState<Retried>({ searchKey, attempt: 0 });
  const attempt = retried.searchKey === searchKey ? retried.attempt : 0;
  const retry = useCallback(() => {
    setRetried((previous) => ({
      searchKey,
      attempt: (previous.searchKey === searchKey ? previous.attempt : 0) + 1,
    }));
  }, [searchKey]);
  useRetryWhenOnline(endedOffline(session), retry);
  return attempt;
}

/**
 * URL の検索状態が変わるたびに検索を走らせ直す。到着は種別ごとに合流し、選択行より上に
 * 入る行は保留する（I4）。入力の途中では走らせない（Enter で明示的に起動、D-2）。
 *
 * 走り始めのセッションは render で導く。effect は runner の起動と打ち切りだけを持ち、
 * 状態は到着の callback（非同期）でしか変えない
 */
export function usePanelSearch(
  search: PanelSearch,
  runner: PanelSearchRunner,
  selectedId: string | undefined,
  learningEnabled: boolean,
) {
  const searchKey = JSON.stringify(search);
  const [store, setStore] = useState<Store>({ key: `${searchKey}#0`, session: undefined });
  const current = store.key.startsWith(`${searchKey}#`) ? store.session : undefined;
  const attempt = useAttempt(searchKey, current);
  const key = `${searchKey}#${attempt}`;
  const session = store.key === key ? store.session : initialSession(search);
  const selected = useRef(selectedId);

  useEffect(() => {
    selected.current = selectedId;
  }, [selectedId]);

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
          const base = previous.key === key ? previous.session : initialSession(search);
          if (base === undefined) return previous;
          if (!outcome.ok) return { key, session: fail(base, kind, outcome.error) };
          const index = base.rows.findIndex((row) => resultRowId(row) === selected.current);
          return {
            key,
            session: arrive(base, kind, outcome.rows, index === -1 ? undefined : index),
          };
        });
      },
      conditions,
    );
    // 入力が変わったら走っている検索を捨てる（palette.md §7.4）
    return cancel;
  }, [search, key, attempt, runner, learningEnabled]);

  const state = useCallback((): SearchState | undefined => {
    if (search.scope === undefined) return undefined;
    return searchState(search.query, search.scope, search.conditions);
  }, [search]);

  return { session, state };
}
