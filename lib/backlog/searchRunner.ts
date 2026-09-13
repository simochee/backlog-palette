import type { QueryClient } from '@tanstack/query-core';

import type { EntityKind } from './entries';
import { type ApiFailure, toApiFailure } from './failure';
import { defaultConditions, kindsFor, type SearchConditions } from './filters';
import type { SearchQueries, SearchRow, SearchScope } from './search';

export type KindOutcome =
  | { ok: true; rows: readonly SearchRow[] }
  | { ok: false; error: ApiFailure };

export type ReportKind = (kind: EntityKind, outcome: KindOutcome) => void;

/**
 * 検索の実行役（entrypoints/palette/search.ts の SearchRunner と同じ形）。種別ごとに
 * 結果を報告し、戻り値で打ち切る。1 種別の失敗は他に影響しない（I6）。合流と保留は
 * lib/search の純粋関数が行うので、ここは取得と報告だけ。
 */
export type SearchRunner = {
  run: (
    query: string,
    scope: SearchScope | { kind: 'root' },
    report: ReportKind,
    conditions?: SearchConditions,
  ) => () => void;
};

export function createSearchRunner(queryClient: QueryClient, queries: SearchQueries): SearchRunner {
  const byKind = { issue: queries.issues, wiki: queries.wikis, document: queries.documents };
  return {
    run(query, scope, report, conditions = defaultConditions) {
      let alive = true;
      const cancel = () => {
        alive = false;
      };
      const settle: ReportKind = (kind, outcome) => {
        // 打ち切り後に届いた結果は捨てる（palette.md §7.4）
        if (alive) report(kind, outcome);
      };
      const kinds = kindsFor(conditions.type);
      // 根では検索しない（D-20）。空の語も同じ
      if (scope.kind === 'root' || query.trim() === '') {
        for (const kind of kinds) settle(kind, { ok: true, rows: [] });
        return cancel;
      }
      for (const kind of kinds) {
        queryClient.query(byKind[kind](query, scope, conditions)).then(
          (rows) => settle(kind, { ok: true, rows }),
          (error: unknown) => settle(kind, { ok: false, error: toApiFailure(error) }),
        );
      }
      return cancel;
    },
  };
}
