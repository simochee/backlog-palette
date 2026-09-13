import { type ActivityEvent, frecencyByEntity } from './frecency';

/** 「課題を開いた後はボード」の 1 回分。from は遷移元のページ種別、to は開いたページの id */
export type TransitionEvent = {
  from: string;
  to: string;
  at: number;
};

/**
 * 遷移パターンの重み（D-16）。空状態の「{プロジェクト} のページ」セクション内の並びにだけ効く。
 * 現在いるページ種別からの遷移だけを数え、他の文脈の履歴は混ぜない。
 */
export function transitionScores(
  events: readonly TransitionEvent[],
  from: string,
  now: number,
): ReadonlyMap<string, number> {
  const activity: ActivityEvent[] = events
    .filter((event) => event.from === from)
    .map((event) => ({ entityId: event.to, at: event.at }));
  return frecencyByEntity(activity, now);
}
