/**
 * スペースごとに返ってくる検索結果を、1 本のフラットな並びに合流させる
 * （実装プラン §3 D6）。
 *
 * 結果はスペースでグループ化しない。グループ見出しを差し込むと、後から
 * 返ったスペースの行が選択行の上に入り、選択位置が動く。
 */

export type MergeableRow = {
  id: string;
  spaceKey: string;
  updatedAt: number;
};

export type ResultList<T extends MergeableRow> = {
  /** 画面に出ている並び */
  readonly rows: readonly T[];
  /**
   * 本来は上位に入るが、選択位置を動かさないために保留している行。
   * 先頭に「N 件の新しい結果」として予告し、選択が先頭に戻ったときに合流する。
   */
  readonly held: readonly T[];
};

export const emptyResultList = <T extends MergeableRow>(): ResultList<T> => ({
  rows: [],
  held: [],
});

export type RankContext = {
  /** 現在のスペース。同点なら優先する */
  currentSpaceKey?: string;
};

/** 現在のスペース優先 → 更新日時の新しい順 → id（決定的にするため） */
export function compareRows<T extends MergeableRow>(a: T, b: T, ctx: RankContext): number {
  const current = ctx.currentSpaceKey;
  if (current !== undefined && a.spaceKey !== b.spaceKey) {
    if (a.spaceKey === current) return -1;
    if (b.spaceKey === current) return 1;
  }

  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 到着した行を合流させる。
 *
 * 選択行より上には差し込まない。差し込むと、読んでいる最中に候補が下へ
 * ずれて、押した先が変わる。上位に入るべき行は保留して予告に回す
 * （§3 D6 の挿入規則）。
 */
export function mergeChunk<T extends MergeableRow>(
  list: ResultList<T>,
  incoming: readonly T[],
  options: { selectedIndex: number; ctx?: RankContext },
): ResultList<T> {
  const ctx = options.ctx ?? {};
  const known = new Set([...list.rows, ...list.held].map((row) => row.id));
  const fresh = incoming.filter((row) => !known.has(row.id));
  if (fresh.length === 0) return list;

  // 選択が先頭にあるなら、読んでいる途中ではない。そのまま並べ直してよい
  if (options.selectedIndex <= 0) {
    const rows = [...list.rows, ...list.held, ...fresh].sort((a, b) => compareRows(a, b, ctx));
    return { rows, held: [] };
  }

  const boundary = list.rows[options.selectedIndex];
  if (boundary === undefined) {
    return { rows: [...list.rows, ...fresh], held: list.held };
  }

  const below: T[] = [];
  const above: T[] = [];
  for (const row of fresh) {
    (compareRows(row, boundary, ctx) < 0 ? above : below).push(row);
  }

  return {
    rows: [...list.rows, ...below].sort((a, b) => {
      const aHeld = list.rows.indexOf(a);
      const bHeld = list.rows.indexOf(b);
      // 既に出ている行の相対位置は動かさない
      if (aHeld !== -1 && bHeld !== -1) return aHeld - bHeld;
      if (aHeld !== -1) return -1;
      if (bHeld !== -1) return 1;
      return compareRows(a, b, ctx);
    }),
    held: [...list.held, ...above],
  };
}

/** 選択が先頭に戻ったときなど、保留していた行を合流させる */
export function promoteHeld<T extends MergeableRow>(
  list: ResultList<T>,
  ctx: RankContext = {},
): ResultList<T> {
  if (list.held.length === 0) return list;

  return {
    rows: [...list.rows, ...list.held].sort((a, b) => compareRows(a, b, ctx)),
    held: [],
  };
}
