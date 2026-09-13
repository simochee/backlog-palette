import type { ResultRow } from './types';

/** 検索行と検索結果セクションの行 id。reducer が選択を置くために derive と共有する */
export const SEARCH_ROW_ID = 'search:search:query';
export const PLACEHOLDER_ROW_ID = 'results:search:searching';
export const NOTICE_ROW_ID = 'results:notice:held';
export const NO_RESULTS_ROW_ID = 'results:hint:no-results';
export const WIDEN_ROW_ID = 'results:search:widen';
export const PANEL_ROW_ID = 'results:panel:panel';
export const EXTERNAL_ROW_ID = 'results:external:open';
export const MORE_EXTERNAL_ROW_ID = 'results:external:more';

export const statusRowId = (spaceId: string): string => `results:status:${spaceId}`;
export const resultRowId = (row: ResultRow): string => `results:${row.kind}:${row.id}`;
