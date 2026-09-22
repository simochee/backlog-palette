import type { ResultRow, SearchError, SearchKind } from '@/lib/search';
import type { SearchConditions, SearchScope } from '@/lib/share';

export type KindOutcome =
  | { ok: true; rows: readonly ResultRow[] }
  | { ok: false; error: SearchError };

/** 検索の実行役。M4 の setupBacklogQueries().runner と同じ形（種別ごとに報告し、戻り値で打ち切る） */
export type PanelSearchRunner = {
  run: (
    query: string,
    scope: SearchScope,
    report: (kind: SearchKind, outcome: KindOutcome) => void,
    conditions: SearchConditions,
  ) => () => void;
};

