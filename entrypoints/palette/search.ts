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
 * 何も取らずに全種別を 0 件で揃える代役。本番は lib/backlog/setup の runner（M4）。
 * 検索行の ↵ が「0 件の提案行」まで辿れる状態を API 無しで成立させ、行と動作の
 * 対応（I1）を検査できるようにするために残す
 */
export const emptySearchRunner: SearchRunner = {
  run(_query, _scope, report) {
    const timer = setTimeout(() => {
      for (const kind of searchKinds) report(kind, { ok: true, rows: [] });
    }, 0);
    return () => clearTimeout(timer);
  },
};
