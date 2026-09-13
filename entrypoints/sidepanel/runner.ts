import { type ResultRow, type SearchError, type SearchKind, searchKinds } from '@/lib/search';
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

/*
 * M4 の Query 層が統合ブランチに入るまでの代役。何も取らずに全種別を 0 件で揃え、
 * 到着 → 0 件の提案行までの配線を先に成立させる。
 */
export const emptyPanelRunner: PanelSearchRunner = {
  run(_query, _scope, report) {
    const timer = setTimeout(() => {
      for (const kind of searchKinds) report(kind, { ok: true, rows: [] });
    }, 0);
    return () => clearTimeout(timer);
  },
};
