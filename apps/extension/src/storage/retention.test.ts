import { describe, expect, it } from 'vitest';
import { DISPLAY_CACHE_LIMIT, isExpired, prune, pruneList, RETENTION_DAYS } from './retention.ts';

const NOW = Date.UTC(2026, 8, 10);
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => NOW - days * DAY;

describe('保持期間', () => {
  it('保持期間を過ぎた記録は期限切れになる', () => {
    expect(isExpired({ lastSeenAt: daysAgo(RETENTION_DAYS + 1) }, NOW)).toBe(true);
  });

  it('保持期間内の記録は残る', () => {
    expect(isExpired({ lastSeenAt: daysAgo(RETENTION_DAYS - 1) }, NOW)).toBe(false);
  });
});

describe('表示キャッシュの間引き', () => {
  it('期限切れの項目は落とされる', () => {
    const pruned = prune(
      {
        'nulab/PROJ-1': { lastSeenAt: daysAgo(1) },
        'nulab/PROJ-2': { lastSeenAt: daysAgo(200) },
      },
      NOW,
    );
    expect(Object.keys(pruned)).toEqual(['nulab/PROJ-1']);
  });

  it('件数上限を超えたら古いものから捨てる', () => {
    const pruned = prune(
      {
        old: { lastSeenAt: daysAgo(3) },
        newest: { lastSeenAt: daysAgo(1) },
        middle: { lastSeenAt: daysAgo(2) },
      },
      NOW,
      { limit: 2 },
    );
    expect(Object.keys(pruned)).toEqual(['newest', 'middle']);
  });

  it('ストレージから読んだキーの順序に結果が左右されない', () => {
    const entries = {
      b: { lastSeenAt: daysAgo(1) },
      a: { lastSeenAt: daysAgo(2) },
    };
    const reversed = { a: entries.a, b: entries.b };
    expect(Object.keys(prune(entries, NOW, { limit: 1 }))).toEqual(
      Object.keys(prune(reversed, NOW, { limit: 1 })),
    );
  });

  it('既定の件数上限は 5,000 件', () => {
    expect(DISPLAY_CACHE_LIMIT).toBe(5_000);
  });
});

describe('行動ログの間引き', () => {
  it('新しい順に並べ直される', () => {
    const pruned = pruneList([{ at: daysAgo(3) }, { at: daysAgo(1) }, { at: daysAgo(2) }], NOW);
    expect(pruned.map((e) => e.at)).toEqual([daysAgo(1), daysAgo(2), daysAgo(3)]);
  });

  it('保持期間を過ぎたイベントは読み出されない', () => {
    expect(pruneList([{ at: daysAgo(200) }], NOW)).toEqual([]);
  });
});
