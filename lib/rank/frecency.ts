export type ActivityEvent = {
  /** 対象の識別子。課題キー・ページ id・プロジェクト id */
  entityId: string;
  /** エポックミリ秒 */
  at: number;
};

/** 重みが半分になるまでの日数。実測で調整する初期値 */
export const HALF_LIFE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 端末の時計ずれで now より後の時刻が記録されうる。負の経過を許すと重みが際限なく増えるので 0 で止める */
export function recencyWeight(at: number, now: number): number {
  const ageDays = Math.max(0, (now - at) / DAY_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

/** 頻度 × 直近性。now は引数で受け、内部で Date.now() を呼ばない（同じ入力なら同じ値） */
export function frecency(events: readonly ActivityEvent[], now: number): number {
  return events.reduce((total, event) => total + recencyWeight(event.at, now), 0);
}

export function frecencyByEntity(
  events: readonly ActivityEvent[],
  now: number,
): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) {
    totals.set(event.entityId, (totals.get(event.entityId) ?? 0) + recencyWeight(event.at, now));
  }
  return totals;
}
