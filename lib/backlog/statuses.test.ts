import { describe, expect, it } from 'vitest';

import { expandNotClosed, unionStatusIds } from './statuses';

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
