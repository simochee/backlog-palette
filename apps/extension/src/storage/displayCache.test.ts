import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { cacheKey, clearHistory, recentVisits, rememberVisit } from './displayCache.ts';
import { displayCacheItem } from './schema.ts';

const NOW = Date.UTC(2026, 8, 10);
const DAY = 24 * 60 * 60 * 1000;

const issue = { title: 'ログイン画面のバリデーション修正', kind: 'issue' } as const;

describe('表示キャッシュ', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('閲覧した項目は API を呼ばずに取り出せる', async () => {
    await rememberVisit('nulab', 'PROJ-123', issue, NOW);

    expect(await recentVisits(NOW)).toEqual([{ ...issue, lastSeenAt: NOW }]);
  });

  it('同じ項目を再訪すると最終閲覧だけが更新される', async () => {
    await rememberVisit('nulab', 'PROJ-123', issue, NOW - DAY);
    await rememberVisit('nulab', 'PROJ-123', issue, NOW);

    const stored = await displayCacheItem.getValue();
    expect(Object.keys(stored)).toEqual(['nulab/PROJ-123']);
    expect(stored['nulab/PROJ-123']?.lastSeenAt).toBe(NOW);
  });

  it('スペースが違えば同じ課題キーでも別の項目として残る', async () => {
    await rememberVisit('nulab', 'PROJ-1', issue, NOW);
    await rememberVisit('acme', 'PROJ-1', issue, NOW);

    expect(Object.keys(await displayCacheItem.getValue()).sort()).toEqual([
      'acme/PROJ-1',
      'nulab/PROJ-1',
    ]);
  });

  it('新しく見たものが先に並ぶ', async () => {
    await rememberVisit('nulab', 'PROJ-1', { ...issue, title: '古い' }, NOW - DAY);
    await rememberVisit('nulab', 'PROJ-2', { ...issue, title: '新しい' }, NOW);

    expect((await recentVisits(NOW)).map((e) => e.title)).toEqual(['新しい', '古い']);
  });

  it('保持期間を過ぎた項目は書き込みのたびに落ちる', async () => {
    await rememberVisit('nulab', 'PROJ-1', issue, NOW - 200 * DAY);
    await rememberVisit('nulab', 'PROJ-2', issue, NOW);

    expect(Object.keys(await displayCacheItem.getValue())).toEqual(['nulab/PROJ-2']);
  });

  it('履歴を消去すると実際にデータが消える', async () => {
    await rememberVisit('nulab', 'PROJ-1', issue, NOW);
    await clearHistory();

    expect(await recentVisits(NOW)).toEqual([]);
  });

  it('キーはスペースと識別子から作る', () => {
    expect(cacheKey('nulab', 'PROJ-123')).toBe('nulab/PROJ-123');
  });
});
