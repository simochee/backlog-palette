import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { rememberVisit } from '../storage/displayCache.ts';
import { settingsItem } from '../storage/schema.ts';
import { buildBootstrap } from './bootstrap.ts';

const NOW = Date.UTC(2026, 8, 10);
const CTX = { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab', projectKey: 'PROJ' };

describe('空状態の組み立て', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('閲覧履歴が無ければセクションを出さない', async () => {
    expect((await buildBootstrap('modal', CTX, NOW)).sections).toEqual([]);
  });

  it('最近開いた項目が新しい順に並ぶ', async () => {
    await rememberVisit('nulab', 'PROJ-1', { title: '古い', kind: 'issue' }, NOW - 1000);
    await rememberVisit('nulab', 'PROJ-2', { title: '新しい', kind: 'issue' }, NOW);

    const [section] = (await buildBootstrap('modal', CTX, NOW)).sections;
    expect(section?.rows.map((row) => row.title)).toEqual(['新しい', '古い']);
  });

  it('先頭の行が選択済みで、Enter のヒントが付く', async () => {
    await rememberVisit('nulab', 'PROJ-1', { title: 'A', kind: 'issue' }, NOW);
    await rememberVisit('nulab', 'PROJ-2', { title: 'B', kind: 'issue' }, NOW - 1);

    const rows = (await buildBootstrap('modal', CTX, NOW)).sections[0]?.rows ?? [];
    expect(rows[0]?.selected).toBe(true);
    expect(rows[0]?.hint).toBe('enter');
    expect(rows[1]?.selected).toBe(false);
  });

  it('件名が課題キーだけのときは等幅の識別子として出す', async () => {
    await rememberVisit('nulab', 'PROJ-9', { title: 'PROJ-9', kind: 'issue' }, NOW);

    expect((await buildBootstrap('modal', CTX, NOW)).sections[0]?.rows[0]?.code).toBe('PROJ-9');
  });

  it('学習をオフにすると「学習で並び替え」を表示しない', async () => {
    await rememberVisit('nulab', 'PROJ-1', { title: 'A', kind: 'issue' }, NOW);
    await settingsItem.setValue({
      ...(await settingsItem.getValue()),
      learningEnabled: false,
    });

    expect((await buildBootstrap('modal', CTX, NOW)).sections[0]?.meta).toBeUndefined();
  });
});

describe('打鍵ごとの一致に渡す索引', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('プロジェクト配下ならプロジェクトのページも索引に入る', async () => {
    const { index } = await buildBootstrap('modal', CTX, NOW);

    expect(index.map((entry) => entry.id)).toContain('page:board');
    expect(index.map((entry) => entry.id)).toContain('page:dashboard');
  });

  it('プロジェクトが分からなければプロジェクトのページは索引に入らない', async () => {
    const { index } = await buildBootstrap(
      'modal',
      { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab' },
      NOW,
    );

    expect(index.map((entry) => entry.id)).not.toContain('page:board');
    expect(index.map((entry) => entry.id)).toContain('page:dashboard');
  });

  it('索引の行には遷移先が対応づいている', async () => {
    const { actions } = await buildBootstrap('modal', CTX, NOW);

    expect(actions['page:board']).toEqual({
      kind: 'navigate',
      url: 'https://nulab.backlog.jp/board/PROJ',
    });
  });

  it('課題ページで開けばコピーコマンドも索引に入る', async () => {
    const { index } = await buildBootstrap('modal', { ...CTX, issueKey: 'PROJ-123' }, NOW);

    expect(index.map((entry) => entry.id)).toContain('command:copy-key');
  });
});
