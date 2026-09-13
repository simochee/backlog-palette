import { describe, expect, it } from 'vitest';

import { queryDictScores, upsertQueryDict } from './queryDict';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 13);

describe('語 → 開いた対象の学習', () => {
  it('同じ語で開いた対象だけが加点され、別の語の記録は効かない', () => {
    const records = [
      { query: 'かだい', entityId: 'page:issues', count: 2, at: now },
      { query: 'ぼ', entityId: 'page:board', count: 5, at: now },
    ];

    const scores = queryDictScores(records, 'かだい', now);

    expect(scores.get('page:issues')).toBeGreaterThan(0);
    expect(scores.has('page:board')).toBe(false);
  });

  it('回数が多く、最近開いたものほど重い', () => {
    const scores = queryDictScores(
      [
        { query: 'か', entityId: 'a', count: 1, at: now },
        { query: 'か', entityId: 'b', count: 3, at: now },
        { query: 'か', entityId: 'c', count: 3, at: now - 60 * DAY },
      ],
      'か',
      now,
    );

    expect(scores.get('b')).toBeGreaterThan(scores.get('a') ?? 0);
    expect(scores.get('b')).toBeGreaterThan(scores.get('c') ?? 0);
  });

  it('同じ語と対象は 1 件にまとめて回数を増やし、時刻を更新する', () => {
    const once = upsertQueryDict([], 'かだい', 'page:issues', now - DAY);
    const twice = upsertQueryDict(once, 'かだい', 'page:issues', now);

    expect(twice).toEqual([{ query: 'かだい', entityId: 'page:issues', count: 2, at: now }]);
  });

  it('上限を超えたら最後に開いた時刻が古い記録から捨てる', () => {
    const records = upsertQueryDict(
      upsertQueryDict([], 'a', 'x', now - 2 * DAY),
      'b',
      'y',
      now - DAY,
    );

    const capped = upsertQueryDict(records, 'c', 'z', now, 2);

    expect(capped.map((record) => record.query)).toEqual(['c', 'b']);
  });
});
