import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { type SpaceConnection, spacesItem } from '../storage/schema.ts';
import { loadSpaceSummaries, summarizeSpace, summarizeSpaces } from './spaceView.ts';

const NOW = Date.UTC(2026, 8, 10, 12);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const nulab: SpaceConnection = {
  spaceKey: 'nulab',
  host: 'nulab.backlog.jp',
  method: 'oauth',
  displayName: 'ヌーラボ',
  lastSyncedAt: NOW - 3 * HOUR,
  state: 'connected',
};

const acme: SpaceConnection = {
  spaceKey: 'acme',
  host: 'acme.backlog.com',
  method: 'apiKey',
  displayName: 'Acme',
  lastSyncedAt: NOW - 12 * DAY,
  state: 'needsReconnect',
};

describe('接続済みスペースの表示', () => {
  it('ホスト・認証方式・最終同期を 1 行にまとめる', () => {
    expect(summarizeSpace(nulab, NOW).detail).toBe('nulab.backlog.jp · OAuth · 3 時間前に同期');
  });

  it('API キーで接続したスペースは方式が API キーと出る', () => {
    expect(summarizeSpace(acme, NOW).detail).toContain('API キー');
  });

  it('同期したことがなければ、その旨を出す', () => {
    const { lastSyncedAt: _lastSyncedAt, ...never } = nulab;

    expect(summarizeSpace(never, NOW).detail).toContain('まだ同期していません');
  });

  it('同期からの経過時間は、分・時間・日のうち読みやすい単位で出る', () => {
    const at = (elapsed: number) => summarizeSpace({ ...nulab, lastSyncedAt: NOW - elapsed }, NOW);

    expect(at(30 * 1000).detail).toContain('たった今同期');
    expect(at(5 * MINUTE).detail).toContain('5 分前に同期');
    expect(at(5 * HOUR).detail).toContain('5 時間前に同期');
    expect(at(5 * DAY).detail).toContain('5 日前に同期');
  });

  it('要再接続のスペースが先頭に並ぶ', () => {
    expect(summarizeSpaces([nulab, acme], NOW).map((s) => s.spaceKey)).toEqual(['acme', 'nulab']);
  });

  it('すべて接続済みなら並びは保存されている順のまま', () => {
    const other: SpaceConnection = { ...acme, state: 'connected' };

    expect(summarizeSpaces([nulab, other], NOW).map((s) => s.spaceKey)).toEqual(['nulab', 'acme']);
  });
});

describe('接続済みスペースの読み出し', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('接続がひとつも無ければ空になる', async () => {
    expect(await loadSpaceSummaries(NOW)).toEqual([]);
  });

  it('保存された接続がそのまま一覧になる', async () => {
    await spacesItem.setValue([nulab]);

    expect((await loadSpaceSummaries(NOW)).map((s) => s.displayName)).toEqual(['ヌーラボ']);
  });
});
