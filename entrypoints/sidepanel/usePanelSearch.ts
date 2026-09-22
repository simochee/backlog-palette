import { useCallback, useEffect, useRef, useState } from 'react';

import { arrive, errorOf, fail, resultRowId, type SearchSession, startSession } from '@/lib/search';
import { type SearchState, searchState } from '@/lib/share';
import { track } from '@/lib/telemetry/track';

import { recordSearch } from './context.ts';
import type { PanelSearchRunner } from './runner.ts';
import { canRun, type PanelSearch } from './searchParams.ts';

type Store = { key: string; session: SearchSession | undefined };

const keyOf = (search: PanelSearch, attempt: number) => `${JSON.stringify(search)}#${attempt}`;
const noop = () => {};

function initialSession(search: PanelSearch): SearchSession | undefined {
  return canRun(search) ? startSession(search.query, search.scope) : undefined;
}

/*
 * オフラインで終わった検索は、接続が戻ったら引き直す（palette.md §7.5）。試行回数をキーに
 * 混ぜて新しいセッションから始める。失敗したセッションに到着を重ねると、先に揃っていた
 * 種別の行が二重に入る
 */
function useRetryWhenOnline(session: SearchSession | undefined, retry: () => void) {
  const offline = session !== undefined && errorOf(session, 'offline') !== undefined;
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
  const [attempt, setAttempt] = useState(0);
  const key = keyOf(search, attempt);
  const [store, setStore] = useState<Store>({ key, session: undefined });
  const session = store.key === key ? store.session : initialSession(search);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  useRetryWhenOnline(session, retry);
  const selected = useRef(selectedId);

  useEffect(() => {
    selected.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!canRun(search)) return noop;
    const { query, scope, conditions } = search;
    if (learningEnabled) void recordSearch(query, scope, Date.now());
    track({ type: 'panelSearchStarted' });
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
  }, [search, key, runner, learningEnabled]);

  const state = useCallback((): SearchState | undefined => {
    if (search.scope === undefined) return undefined;
    return searchState(search.query, search.scope, search.conditions);
  }, [search]);

  return { session, state };
}
