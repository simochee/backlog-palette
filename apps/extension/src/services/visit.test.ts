import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { recentVisits } from '../storage/displayCache.ts';
import { activityItem } from '../storage/schema.ts';
import { frecencyIndex } from './activity/index.ts';
import { buildLocalIndex } from './localIndex.ts';
import { recordVisit } from './visit.ts';

const NOW = Date.UTC(2026, 8, 10);
const CTX = { origin: 'https://nulab.backlog.jp', spaceKey: 'nulab', projectKey: 'PROJ' };

const visit = {
  spaceKey: 'nulab',
  id: 'PROJ-123',
  title: 'ログイン画面のバリデーション修正',
  kind: 'issue',
} as const;

describe('閲覧の記録', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('表示キャッシュに残る', async () => {
    await recordVisit(visit, NOW);

    expect((await recentVisits(NOW)).map((entry) => entry.title)).toEqual([visit.title]);
  });

  it('索引に出てくる行と同じ id で学習される', async () => {
    await recordVisit(visit, NOW);

    const { entries } = await buildLocalIndex(CTX, NOW);
    const row = entries.find((entry) => entry.text === visit.title);
    const frecencyOf = await frecencyIndex(NOW);

    expect(row).toBeDefined();
    expect(frecencyOf(row?.id ?? '')).toBeGreaterThan(0);
  });

  it('行動ログには ID と種別と時刻しか残らない', async () => {
    await recordVisit({ ...visit, projectName: '新規プロジェクト' }, NOW);

    const [event] = await activityItem.getValue();
    expect(Object.keys(event ?? {}).sort()).toEqual(['at', 'entityId', 'kind']);
    expect(event?.kind).toBe('opened');
    expect(event?.at).toBe(NOW);
  });
});

describe('行動ログに残さないもの', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('件名は行動ログに入らない', async () => {
    const subject = 'ログイン画面のバリデーション修正';
    await recordVisit(
      { spaceKey: 'nulab', id: 'PROJ-123', title: subject, kind: 'issue' },
      Date.now(),
    );

    const stored = await fakeBrowser.storage.local.get('activity');
    expect(JSON.stringify(stored)).not.toContain(subject);
  });

  it('行動ログに残るのはキーと種別と時刻だけ', async () => {
    await recordVisit(
      { spaceKey: 'nulab', id: 'PROJ-123', title: '件名', kind: 'issue' },
      Date.now(),
    );

    const stored = await fakeBrowser.storage.local.get('activity');
    const events = (stored.activity ?? []) as Record<string, unknown>[];
    expect(events[0] === undefined ? [] : Object.keys(events[0]).sort()).toEqual([
      'at',
      'entityId',
      'kind',
    ]);
    expect(String(events[0]?.entityId)).toBe('recent:nulab/PROJ-123');
  });
});
