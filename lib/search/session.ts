import type { Scope } from '@/lib/stack/types';

import {
  type KindProgress,
  type ResultRow,
  type SearchError,
  type SearchKind,
  searchKinds,
  type SearchSession,
} from './types';

/** 表示上限。超えた分は external 行の「他 N 件」に回す（§7.3） */
export const RESULT_CAP = 30;

export function startSession(query: string, scope: Scope): SearchSession {
  return {
    query,
    scope,
    kinds: {
      issue: { state: 'loading' },
      wiki: { state: 'loading' },
      document: { state: 'loading' },
    },
    rows: [],
    held: [],
    overflow: 0,
  };
}

/** 一致の強さ（件名に一致） → 更新日時の新しい順 → id で決定的に（§7.3） */
export function compareRows(a: ResultRow, b: ResultRow): number {
  if (a.titleMatched !== b.titleMatched) return a.titleMatched ? -1 : 1;
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function capped(session: SearchSession, rows: readonly ResultRow[], held: readonly ResultRow[]) {
  const cut = Math.max(0, rows.length - RESULT_CAP);
  return { ...session, rows: rows.slice(0, RESULT_CAP), held, overflow: session.overflow + cut };
}

function withProgress(session: SearchSession, kind: SearchKind, progress: KindProgress) {
  return { ...session, kinds: { ...session.kinds, [kind]: progress } };
}

/**
 * 種別単位の到着（§7.3）。選択行より上に入るはずの行は保留する（I4）。全体を並べ直せるのは
 * 選択が結果より上（検索行・プレースホルダ・notice）にあるとき（selectedIndex が undefined）だけで、
 * 先頭ヒットを選んでいるときも上に入る行は保留する。選択行より下は自由に並べ直してよい
 */
export function arrive(
  session: SearchSession,
  kind: SearchKind,
  incoming: readonly ResultRow[],
  selectedIndex?: number,
): SearchSession {
  const progressed = withProgress(session, kind, { state: 'ready', count: incoming.length });
  const known = new Set([...session.rows, ...session.held].map((row) => row.id));
  const fresh = incoming.filter((row) => !known.has(row.id));

  if (selectedIndex === undefined || session.rows.length === 0) {
    return capped(
      progressed,
      [...session.rows, ...session.held, ...fresh].toSorted(compareRows),
      [],
    );
  }

  const boundary = session.rows[selectedIndex] ?? session.rows.at(-1);
  const above = fresh.filter((row) => boundary !== undefined && compareRows(row, boundary) < 0);
  const below = fresh.filter((row) => !above.includes(row));
  const kept = session.rows.slice(0, selectedIndex + 1);
  const rest = [...session.rows.slice(selectedIndex + 1), ...below].toSorted(compareRows);
  return capped(progressed, [...kept, ...rest], [...session.held, ...above]);
}

/** 選択が先頭に戻ったとき、または notice 行の ↵（§7.3） */
export function mergeHeld(session: SearchSession): SearchSession {
  if (session.held.length === 0) return session;
  return capped(session, [...session.rows, ...session.held].toSorted(compareRows), []);
}

export function fail(session: SearchSession, kind: SearchKind, error: SearchError): SearchSession {
  return withProgress(session, kind, { state: 'error', error });
}

export function isDone(session: SearchSession): boolean {
  return searchKinds.every((kind) => session.kinds[kind].state !== 'loading');
}

/** 全種別が揃って 0 件（§7.5） */
export function isEmpty(session: SearchSession): boolean {
  return isDone(session) && session.rows.length === 0 && session.held.length === 0;
}

export function totalCount(session: SearchSession): number {
  return searchKinds.reduce((sum, kind) => {
    const progress = session.kinds[kind];
    return progress.state === 'ready' ? sum + progress.count : sum;
  }, 0);
}

export function errorOf(
  session: SearchSession,
  kind: SearchError['kind'],
): SearchError | undefined {
  for (const name of searchKinds) {
    const progress = session.kinds[name];
    if (progress.state === 'error' && progress.error.kind === kind) return progress.error;
  }
  return undefined;
}

/** オフラインで終わった種別がある。接続が戻ったら引き直す対象（palette.md §7.5） */
export function endedOffline(session?: SearchSession): boolean {
  return session !== undefined && errorOf(session, 'offline') !== undefined;
}
