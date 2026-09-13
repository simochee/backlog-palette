import { searchKinds } from '@/lib/search';
import type { ResultRow, SearchError, SearchKind } from '@/lib/search/types';
import type { Scope } from '@/lib/stack/types';

export type KindOutcome =
  | { ok: true; rows: readonly ResultRow[] }
  | { ok: false; error: SearchError };

/**
 * 検索の実行役。種別（課題・Wiki・ドキュメント）ごとに結果を報告し、戻り値で打ち切る。
 * 合流と保留は lib/search の純粋関数が行うので、ここは取得と報告だけ（tech-stack.md §3.1）
 */
export type SearchRunner = {
  run: (
    query: string,
    scope: Scope,
    report: (kind: SearchKind, outcome: KindOutcome) => void,
  ) => () => void;
};

/*
 * M4 の Query 層（1 スペース内で種別を useQueries で並列）が差し込まれるまでの代役。
 * 何も取らずに全種別を 0 件で揃える。検索行の ↵ が「0 件の提案行」まで辿れる状態を
 * 先に成立させ、行と動作の対応（I1）を検査できるようにする
 */
export const emptySearchRunner: SearchRunner = {
  run(_query, _scope, report) {
    const timer = setTimeout(() => {
      for (const kind of searchKinds) report(kind, { ok: true, rows: [] });
    }, 0);
    return () => clearTimeout(timer);
  },
};
