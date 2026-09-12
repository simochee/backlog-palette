import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { searchHistoryItem } from '../storage/schema.ts';
import {
  clearSearchHistory,
  recentQueries,
  rememberQuery,
  SEARCH_HISTORY_LIMIT,
} from './searchHistory.ts';

describe('検索履歴', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('検索したクエリが残る', async () => {
    await rememberQuery('請求書');

    expect(await recentQueries()).toEqual(['請求書']);
  });

  it('新しく検索したものが先に並ぶ', async () => {
    await rememberQuery('請求書');
    await rememberQuery('ログイン');

    expect(await recentQueries()).toEqual(['ログイン', '請求書']);
  });

  it('同じクエリを検索し直すと重複せず先頭に寄る', async () => {
    await rememberQuery('請求書');
    await rememberQuery('ログイン');
    await rememberQuery('請求書');

    expect(await recentQueries()).toEqual(['請求書', 'ログイン']);
  });

  it('前後の空白は落として同じクエリとして扱う', async () => {
    await rememberQuery('請求書');
    await rememberQuery('  請求書  ');

    expect(await recentQueries()).toEqual(['請求書']);
  });

  it('空のクエリは残さない', async () => {
    await rememberQuery('   ');

    expect(await recentQueries()).toEqual([]);
  });

  it('上限を超えると古いものから落ちる', async () => {
    for (let i = 0; i <= SEARCH_HISTORY_LIMIT; i += 1) {
      await rememberQuery(`クエリ${i}`);
    }

    const history = await recentQueries();
    expect(history).toHaveLength(SEARCH_HISTORY_LIMIT);
    expect(history[0]).toBe(`クエリ${SEARCH_HISTORY_LIMIT}`);
    expect(history).not.toContain('クエリ0');
  });

  it('消去すると実際にデータが消える', async () => {
    await rememberQuery('請求書');
    await clearSearchHistory();

    expect(await recentQueries()).toEqual([]);
    expect(await searchHistoryItem.getValue()).toEqual([]);
  });
});
