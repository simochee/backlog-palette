import { describe, expect, it } from 'vitest';

import { expandNotClosed, isBuiltinStatus, unionStatusIds } from './statuses';

const statuses = {
  '101': [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 10101 }],
  '102': [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
};

describe('ステータス条件の展開', () => {
  it('「完了を除く」はプロジェクトごとの statusId 集合に展開される', () => {
    expect(expandNotClosed(statuses)).toEqual({
      '101': [1, 2, 3, 10101],
      '102': [1, 2, 3],
    });
  });

  it('複数プロジェクトを 1 回で引くときは集合を合併し、重複を落とす', () => {
    expect(unionStatusIds(expandNotClosed(statuses))).toEqual([1, 2, 3, 10101]);
  });
});

describe('プロジェクトをまたぐステータス', () => {
  it('組み込み 4 種（未対応・処理中・処理済み・完了）はどのプロジェクトでも同じ ID を指す', () => {
    expect([1, 2, 3, 4].every((id) => isBuiltinStatus(id))).toBe(true);
  });

  it('カスタムステータスはそのプロジェクトでしか通じない', () => {
    expect(isBuiltinStatus(10101)).toBe(false);
  });
});
