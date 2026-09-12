import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { rememberVisit } from '../storage/displayCache.ts';
import { DEFAULT_SETTINGS, settingsItem, spacesItem } from '../storage/schema.ts';
import { buildBootstrap } from './bootstrap.ts';
import { recordVisit } from './visit.ts';

const NOW = Date.UTC(2026, 8, 10);
const CTX = { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab', projectKey: 'PROJ' };

describe('空状態の組み立て', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('閲覧履歴が無くても、現在プロジェクトのページは出す', async () => {
    const { sections } = await buildBootstrap('modal', CTX, NOW);

    expect(sections.map((section) => section.id)).toEqual(['pages']);
    expect(sections[0]?.label).toBe('PROJ のページ');
  });

  it('プロジェクトも履歴も無ければセクションを出さない', async () => {
    const { sections } = await buildBootstrap(
      'modal',
      { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab' },
      NOW,
    );

    expect(sections).toEqual([]);
  });

  it('最初の行だけが選択され、Enter のヒントが付く', async () => {
    const { sections } = await buildBootstrap('modal', CTX, NOW);
    const rows = sections.flatMap((section) => section.rows);

    expect(rows[0]?.selected).toBe(true);
    expect(rows[0]?.hint).toBe('enter');
    expect(rows.slice(1).every((row) => row.selected === false)).toBe(true);
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

describe('プロジェクトの索引', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('接続していないスペースのプロジェクトは索引に入らない', async () => {
    const { index } = await buildBootstrap('modal', CTX, NOW);

    expect(index.filter((entry) => entry.kind === 'project')).toEqual([]);
  });
});

describe('索引に添える frecency', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('閲覧した行には索引の id で frecency が付く', async () => {
    await recordVisit(
      { spaceKey: 'nulab', id: 'PROJ-1', title: 'ログイン修正', kind: 'issue' },
      NOW,
    );

    const { index, frecency } = await buildBootstrap('modal', CTX, NOW);
    const row = index.find((entry) => entry.text === 'ログイン修正');

    expect(row).toBeDefined();
    expect(frecency[row?.id ?? '']).toBeGreaterThan(0);
  });

  it('学習をオフにしていると frecency は渡らない', async () => {
    await recordVisit(
      { spaceKey: 'nulab', id: 'PROJ-1', title: 'ログイン修正', kind: 'issue' },
      NOW,
    );
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, learningEnabled: false });

    expect((await buildBootstrap('modal', CTX, NOW)).frecency).toEqual({});
  });

  it('触っていない行は frecency を持たない', async () => {
    const { frecency } = await buildBootstrap('modal', CTX, NOW);

    expect(frecency['page:board']).toBeUndefined();
  });
});

describe('未接続のスペース', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('接続済みが 1 つも無ければ、未接続の行を出さない', async () => {
    const { index } = await buildBootstrap('modal', CTX, NOW);

    expect(index.some((entry) => entry.id === 'connect-current')).toBe(false);
  });

  it('他のスペースが接続済みなら、今いる未接続のスペースを末尾に出す', async () => {
    await spacesItem.setValue([
      {
        spaceKey: 'acme',
        host: 'acme.backlog.com',
        method: 'apiKey',
        displayName: 'acme',
        state: 'connected',
      },
    ]);

    const { index, actions } = await buildBootstrap('modal', CTX, NOW);
    const row = index.find((entry) => entry.id === 'connect-current');

    expect(row?.text).toContain('nulab は未接続');
    expect(actions['connect-current']).toEqual({
      kind: 'navigate',
      url: 'https://nulab.backlog.jp/EditApiSettings.action#bp-connect',
    });
  });

  it('接続済みのスペースでは未接続の行を出さない', async () => {
    await spacesItem.setValue([
      {
        spaceKey: 'nulab',
        host: 'nulab.backlog.jp',
        method: 'apiKey',
        displayName: 'nulab',
        state: 'connected',
      },
    ]);

    const { index } = await buildBootstrap('modal', CTX, NOW);
    expect(index.some((entry) => entry.id === 'connect-current')).toBe(false);
  });
});
