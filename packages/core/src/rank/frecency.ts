export type ActivityKind = 'opened' | 'selected' | 'previewed' | 'cancelled';

export type ActivityEvent = {
  /** 対象の識別子（課題キー・プロジェクト ID・ページ ID など） */
  entityId: string;
  kind: ActivityKind;
  /** エポックミリ秒 */
  at: number;
};

/** 重みが半分になるまでの日数（§7.3 の初期値。実測で調整する） */
export const HALF_LIFE_DAYS = 14;

export const ACTIVITY_WEIGHT: Record<ActivityKind, number> = {
  opened: 1.0,
  selected: 1.5,
  previewed: 0.3,
  cancelled: -0.2,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 端末の時計ずれや別端末との同期で、now より後の時刻が記録されうる。
 * 経過日数をそのまま負にすると 0.5^負 が 1 を超えて際限なく重くなるので 0 で止める。
 */
function ageDays(at: number, now: number): number {
  return Math.max(0, (now - at) / DAY_MS);
}

function decayed(event: ActivityEvent, now: number): number {
  return ACTIVITY_WEIGHT[event.kind] * 0.5 ** (ageDays(event.at, now) / HALF_LIFE_DAYS);
}

/** now は引数で受ける。内部で Date.now() を呼ばない（同じ入力なら常に同じ値にする） */
export function frecency(events: readonly ActivityEvent[], now: number): number {
  return Math.max(
    0,
    events.reduce((total, event) => total + decayed(event, now), 0),
  );
}

export function frecencyByEntity(
  events: readonly ActivityEvent[],
  now: number,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) {
    totals.set(event.entityId, (totals.get(event.entityId) ?? 0) + decayed(event, now));
  }
  return new Map([...totals].map(([entityId, total]) => [entityId, Math.max(0, total)]));
}
