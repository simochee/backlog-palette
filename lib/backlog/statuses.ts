/**
 * Backlog 組み込みの「完了」。組み込み 4 種（未対応 1・処理中 2・処理済み 3・完了 4）の ID は
 * プロジェクトをまたいで同じで、カスタムステータスの ID はプロジェクト固有（backlog-facts.md §3.5）。
 */
export const CLOSED_STATUS_ID = 4;

export const BUILTIN_STATUS_IDS = [1, 2, 3, CLOSED_STATUS_ID] as const;

/** 組み込み 4 種か。組み込みの ID だけが、プロジェクトを変えても同じステータスを指す */
export function isBuiltinStatus(id: number): boolean {
  return (BUILTIN_STATUS_IDS as readonly number[]).includes(id);
}

export type StatusRef = { id: number };

/** プロジェクト ID → そのプロジェクトのステータス一覧 */
export type StatusesByProject = Record<string, readonly StatusRef[]>;

/**
 * 「完了を除く」をプロジェクトごとの statusId 集合に展開する。ステータスはプロジェクトごとに
 * ID が違うので、1 つの ID 集合では絞れない（backlog-facts.md §3.5）。
 */
export function expandNotClosed(statuses: StatusesByProject): Record<string, number[]> {
  return Object.fromEntries(
    Object.entries(statuses).map(([projectId, list]) => [
      projectId,
      list.filter((status) => status.id !== CLOSED_STATUS_ID).map((status) => status.id),
    ]),
  );
}

/**
 * 複数プロジェクトを 1 回の GET /issues で引くときの statusId[]。カスタムステータスの ID は
 * プロジェクト固有なので、合併しても他のプロジェクトを誤って絞らない。
 */
export function unionStatusIds(byProject: Record<string, readonly number[]>): number[] {
  return [...new Set(Object.values(byProject).flat())].toSorted((a, b) => a - b);
}
