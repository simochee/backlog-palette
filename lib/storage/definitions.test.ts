import { describe, expect, it } from 'vitest';

import { displayCacheSchema, searchHistorySchema, spaceSchema } from './definitions';

describe('コレクションのスキーマ', () => {
  it('表示キャッシュは URL・種別・スペース・プロジェクトが揃った行だけを受ける', () => {
    expect(
      displayCacheSchema.safeParse({
        url: 'https://nulab.backlog.com/view/PROJ-1',
        kind: 'issue',
        spaceHost: 'nulab.backlog.com',
        projectKey: 'PROJ',
        key: 'PROJ-1',
        visitedAt: 1,
      }).success,
    ).toBe(true);
    expect(displayCacheSchema.safeParse({ url: 'x', kind: 'issue' }).success).toBe(false);
  });

  it('検索履歴のスコープに根は無い（根では検索しない、D-20）', () => {
    expect(
      searchHistorySchema.safeParse({ query: 'q', scope: { kind: 'root' }, at: 1 }).success,
    ).toBe(false);
    expect(
      searchHistorySchema.safeParse({
        query: 'q',
        scope: { kind: 'space', spaceId: 'nulab' },
        at: 1,
      }).success,
    ).toBe(true);
  });

  it('スペースの記録はホストが識別子で、鍵を持たない', () => {
    const parsed = spaceSchema.safeParse({
      host: 'demo.backlog.jp',
      name: 'デモ',
      spaceKey: 'demo',
      projectCount: 3,
      connectedAt: 1,
      apiKey: 'secret',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'apiKey' in parsed.data).toBe(false);
  });
});
