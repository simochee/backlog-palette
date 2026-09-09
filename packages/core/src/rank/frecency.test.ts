import { describe, expect, it } from 'vitest';
import {
  type ActivityEvent,
  type ActivityKind,
  frecency,
  frecencyByEntity,
  HALF_LIFE_DAYS,
} from './frecency.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-01-15T09:00:00Z').getTime();

function event(kind: ActivityKind, daysAgo: number, entityId = 'PROJ-1234'): ActivityEvent {
  return { entityId, kind, at: now - daysAgo * DAY_MS };
}

describe('直近性の減衰', () => {
  it('行動の記録が無ければ 0', () => {
    expect(frecency([], now)).toBe(0);
  });

  it('たった今の 1 回は、その種別の重みそのまま', () => {
    expect(frecency([event('opened', 0)], now)).toBe(1.0);
  });

  it('14 日前の 1 回は、今日の 1 回の半分の重みになる', () => {
    expect(frecency([event('opened', HALF_LIFE_DAYS)], now)).toBeCloseTo(
      frecency([event('opened', 0)], now) / 2,
    );
  });

  it('半減期の 2 倍だけ過ぎた 1 回は、4 分の 1 の重みになる', () => {
    expect(frecency([event('opened', HALF_LIFE_DAYS * 2)], now)).toBeCloseTo(0.25);
  });

  it('未来の時刻が記録されていても、たった今の 1 回より重くはならない', () => {
    expect(frecency([event('opened', -30)], now)).toBe(1.0);
  });
});

describe('行動の種別ごとの重み', () => {
  it('パレットから選んだ操作は、ただ開いただけより重い', () => {
    expect(frecency([event('selected', 0)], now)).toBeGreaterThan(
      frecency([event('opened', 0)], now),
    );
  });

  it('プレビューしただけの操作は、開いた操作より軽い', () => {
    expect(frecency([event('previewed', 0)], now)).toBeLessThan(
      frecency([event('opened', 0)], now),
    );
  });

  it('同じ対象を何度も使うほど積み上がる', () => {
    const once = frecency([event('opened', 0)], now);
    const thrice = frecency([event('opened', 0), event('opened', 0), event('opened', 0)], now);
    expect(thrice).toBeCloseTo(once * 3);
  });

  it('キャンセルは順位を下げる', () => {
    expect(frecency([event('selected', 0), event('cancelled', 0)], now)).toBeLessThan(
      frecency([event('selected', 0)], now),
    );
  });

  it('スコアの合計が負になっても 0 未満にはならない', () => {
    const onlyCancelled = [event('cancelled', 0), event('cancelled', 1), event('cancelled', 2)];
    expect(frecency(onlyCancelled, now)).toBe(0);
  });
});

describe('対象ごとの集計', () => {
  it('対象ごとに分けて合計する', () => {
    const totals = frecencyByEntity(
      [event('opened', 0, 'PROJ-1'), event('opened', 0, 'PROJ-1'), event('opened', 0, 'PROJ-2')],
      now,
    );
    expect(totals.get('PROJ-1')).toBeCloseTo(2.0);
    expect(totals.get('PROJ-2')).toBeCloseTo(1.0);
  });

  it('記録の無い対象は含まれない', () => {
    const totals = frecencyByEntity([event('opened', 0, 'PROJ-1')], now);
    expect(totals.has('PROJ-2')).toBe(false);
  });

  it('対象ごとの合計も 0 未満にはならない', () => {
    const totals = frecencyByEntity([event('cancelled', 0, 'PROJ-1')], now);
    expect(totals.get('PROJ-1')).toBe(0);
  });
});
