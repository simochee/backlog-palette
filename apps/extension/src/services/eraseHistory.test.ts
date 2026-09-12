import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { recentVisits } from '../storage/displayCache.ts';
import { activityItem } from '../storage/schema.ts';
import { frecencyIndex } from './activity/index.ts';
import { eraseHistory } from './eraseHistory.ts';
import { recentQueries, rememberQuery } from './searchHistory.ts';
import { recordVisit } from './visit.ts';

const NOW = Date.UTC(2026, 8, 10);

describe('履歴の消去', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('閲覧履歴も行動ログも実際に消える', async () => {
    await recordVisit(
      { spaceKey: 'nulab', id: 'PROJ-1', title: 'ログイン修正', kind: 'issue' },
      NOW,
    );

    await eraseHistory();

    expect(await recentVisits(NOW)).toEqual([]);
    expect(await activityItem.getValue()).toEqual([]);
    expect((await frecencyIndex(NOW))('recent:ログイン修正')).toBe(0);
  });

  it('検索したクエリも残らない', async () => {
    await rememberQuery('請求書');

    await eraseHistory();

    expect(await recentQueries()).toEqual([]);
  });
});
