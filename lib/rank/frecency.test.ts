import { describe, expect, it } from 'vitest';

import { frecency, frecencyByEntity, HALF_LIFE_DAYS } from './frecency';
import { transitionScores } from './transitions';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 13);
const daysAgo = (days: number) => now - days * DAY;

describe('frecency', () => {
  it('今開いた 1 回は半減期の日数だけ前の 1 回の 2 倍の重みを持つ', () => {
    const recent = frecency([{ entityId: 'a', at: now }], now);
    const old = frecency([{ entityId: 'a', at: daysAgo(HALF_LIFE_DAYS) }], now);
    expect(recent).toBeCloseTo(old * 2);
  });

  it('同じ日なら回数が多いほど高い', () => {
    const once = frecency([{ entityId: 'a', at: daysAgo(1) }], now);
    const twice = frecency(
      [
        { entityId: 'a', at: daysAgo(1) },
        { entityId: 'a', at: daysAgo(1) },
      ],
      now,
    );
    expect(twice).toBeGreaterThan(once);
  });

  it('時計のずれで未来になった記録は今と同じ重みで数える', () => {
    expect(frecency([{ entityId: 'a', at: now + DAY }], now)).toBe(1);
  });

  it('記録が無ければ 0', () => {
    expect(frecency([], now)).toBe(0);
  });

  it('対象ごとに集計できる', () => {
    const totals = frecencyByEntity(
      [
        { entityId: 'a', at: now },
        { entityId: 'b', at: now },
        { entityId: 'a', at: now },
      ],
      now,
    );
    expect(totals.get('a')).toBe(2);
    expect(totals.get('b')).toBe(1);
  });
});

describe('遷移パターン', () => {
  const log = [
    { from: 'issue', to: 'board', at: daysAgo(1) },
    { from: 'issue', to: 'board', at: daysAgo(2) },
    { from: 'issue', to: 'gantt', at: daysAgo(1) },
    { from: 'wiki', to: 'issues', at: daysAgo(1) },
  ];

  it('「課題を開いた後はボード」は課題ページからの遷移回数で決まる', () => {
    const scores = transitionScores(log, 'issue', now);
    expect(scores.get('board') ?? 0).toBeGreaterThan(scores.get('gantt') ?? 0);
  });

  it('いま居るページ種別と違う遷移元の履歴は数えない', () => {
    expect(transitionScores(log, 'issue', now).has('issues')).toBe(false);
  });

  it('遷移の記録が無い文脈では何も並び替えない', () => {
    expect(transitionScores(log, 'document', now).size).toBe(0);
  });
});
