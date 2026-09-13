import {
  PANEL_ROW_ID,
  PLACEHOLDER_ROW_ID,
  resultRowId,
  SEARCH_ROW_ID,
  statusRowId,
  WIDEN_ROW_ID,
} from '@/lib/search/ids';
import { arrive, fail, isEmpty, mergeHeld, startSession } from '@/lib/search/session';
import type { ResultRow, SearchError, SearchKind, SearchSession } from '@/lib/search/types';
import type { Scope } from '@/lib/stack/types';

import type { PaletteState } from './state';

function firstResultId(session: SearchSession): string | undefined {
  const first = session.rows[0];
  return first === undefined ? undefined : resultRowId(first);
}

/** 0 件が確定したら選択は最初の提案行へ（D-19）: スコープを広げる › 詳細検索 */
function emptySelection(session: SearchSession): string {
  return session.scope.kind === 'project' ? WIDEN_ROW_ID : PANEL_ROW_ID;
}

export function searchStarted(state: PaletteState, query: string, scope: Scope): PaletteState {
  return {
    ...state,
    session: startSession(query, scope),
    selectedId: PLACEHOLDER_ROW_ID,
    toast: undefined,
  };
}

/** 選択が結果の何行目にあるか。結果より上（検索行・プレースホルダ・notice）にいれば undefined */
function selectedIndexIn(
  session: SearchSession,
  selectedId: string | undefined,
): number | undefined {
  const index = session.rows.findIndex((row) => resultRowId(row) === selectedId);
  return index === -1 ? undefined : index;
}

export function resultsArrived(
  state: PaletteState,
  kind: SearchKind,
  rows: readonly ResultRow[],
): PaletteState {
  if (state.session === undefined) return state;
  const session = arrive(
    state.session,
    kind,
    rows,
    selectedIndexIn(state.session, state.selectedId),
  );
  // プレースホルダは最初の結果にその場で置き換わる（§7.2）。語 → ↵ → ↵ で先頭ヒットが開く
  const selectedId =
    state.selectedId === PLACEHOLDER_ROW_ID
      ? (firstResultId(session) ?? PLACEHOLDER_ROW_ID)
      : state.selectedId;
  return {
    ...state,
    session,
    selectedId: isEmpty(session) ? emptySelection(session) : selectedId,
  };
}

export function searchFailed(
  state: PaletteState,
  kind: SearchKind,
  error: SearchError,
): PaletteState {
  if (state.session === undefined) return state;
  const session = fail(state.session, kind, error);
  const spaceId = session.scope.kind === 'root' ? 'current' : session.scope.spaceId;
  const onPlaceholder = state.selectedId === PLACEHOLDER_ROW_ID;
  const selectedId =
    error.kind === 'offline' || !onPlaceholder ? state.selectedId : statusRowId(spaceId);
  return { ...state, session, selectedId: isEmpty(session) ? emptySelection(session) : selectedId };
}

export function heldMerged(state: PaletteState): PaletteState {
  if (state.session === undefined) return state;
  const session = mergeHeld(state.session);
  return { ...state, session, selectedId: firstResultId(session) };
}

/** ↑ で選択が先頭（検索行）に戻ったとき保留を合流させる（§7.3） */
export function selectedWithMerge(state: PaletteState, id: string): PaletteState {
  if (id === SEARCH_ROW_ID && state.session !== undefined && state.session.held.length > 0)
    return { ...state, session: mergeHeld(state.session) };
  return state;
}
