import type { ActivityEvent } from '@backlog-palette/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ACTIVITY_LIMIT } from '../../storage/retention.ts';
import { activityItem, DEFAULT_SETTINGS, settingsItem } from '../../storage/schema.ts';
import { clearActivity, frecencyIndex, recordActivity } from './activity.ts';

const NOW = Date.UTC(2026, 8, 10);
const DAY = 24 * 60 * 60 * 1000;

async function turnLearningOff(): Promise<void> {
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, learningEnabled: false });
}

function opened(entityId: string, at: number): ActivityEvent {
  return { entityId, kind: 'opened', at };
}

describe('行動ログ', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('記録するのは ID と種別と時刻だけで、件名やクエリは含まない', async () => {
    await recordActivity(opened('recent:PROJ-1', NOW));

    expect(await activityItem.getValue()).toEqual([
      { entityId: 'recent:PROJ-1', kind: 'opened', at: NOW },
    ]);
  });

  it('よく開いた項目ほど frecency が高い', async () => {
    await recordActivity(opened('recent:よく見る', NOW - 2 * DAY));
    await recordActivity(opened('recent:よく見る', NOW - DAY));
    await recordActivity(opened('recent:よく見る', NOW));
    await recordActivity(opened('recent:たまに見る', NOW));

    const frecencyOf = await frecencyIndex(NOW);
    expect(frecencyOf('recent:よく見る')).toBeGreaterThan(frecencyOf('recent:たまに見る'));
  });

  it('同じ回数なら最近触った項目ほど frecency が高い', async () => {
    await recordActivity(opened('recent:きのう', NOW - DAY));
    await recordActivity(opened('recent:先月', NOW - 30 * DAY));

    const frecencyOf = await frecencyIndex(NOW);
    expect(frecencyOf('recent:きのう')).toBeGreaterThan(frecencyOf('recent:先月'));
  });

  it('記録の無い項目の frecency は 0', async () => {
    expect((await frecencyIndex(NOW))('recent:見ていない')).toBe(0);
  });

  it('パレットから選んだ記録は、ただ開いた記録より重い', async () => {
    await recordActivity({ entityId: 'recent:選んだ', kind: 'selected', at: NOW });
    await recordActivity(opened('recent:開いた', NOW));

    const frecencyOf = await frecencyIndex(NOW);
    expect(frecencyOf('recent:選んだ')).toBeGreaterThan(frecencyOf('recent:開いた'));
  });

  it('学習をオフにしていると行動ログを記録しない', async () => {
    await turnLearningOff();
    await recordActivity(opened('recent:PROJ-1', NOW));

    expect(await activityItem.getValue()).toEqual([]);
  });

  it('学習をオフにすると、記録済みのログも並びに使わない', async () => {
    await recordActivity(opened('recent:PROJ-1', NOW));
    await turnLearningOff();

    expect((await frecencyIndex(NOW))('recent:PROJ-1')).toBe(0);
  });

  it('保持期間を過ぎたログは並びに使わない', async () => {
    await activityItem.setValue([opened('recent:大昔', NOW - 200 * DAY)]);

    expect((await frecencyIndex(NOW))('recent:大昔')).toBe(0);
  });

  it('保持期間を過ぎたログは次の書き込みで捨てられる', async () => {
    await activityItem.setValue([opened('recent:大昔', NOW - 200 * DAY)]);
    await recordActivity(opened('recent:いま', NOW));

    expect((await activityItem.getValue()).map((event) => event.entityId)).toEqual(['recent:いま']);
  });

  it('件数上限を超えたら古いものから捨てる', async () => {
    const full = Array.from({ length: ACTIVITY_LIMIT }, (_, index) =>
      opened(`recent:${index}`, NOW - (ACTIVITY_LIMIT - index) * 1_000),
    );
    await activityItem.setValue(full);
    await recordActivity(opened('recent:いま', NOW));

    const stored = await activityItem.getValue();
    expect(stored).toHaveLength(ACTIVITY_LIMIT);
    expect(stored[0]?.entityId).toBe('recent:いま');
    expect(stored.some((event) => event.entityId === 'recent:0')).toBe(false);
  });

  it('消去すると記録は残らない', async () => {
    await recordActivity(opened('recent:PROJ-1', NOW));
    await clearActivity();

    expect(await activityItem.getValue()).toEqual([]);
    expect((await frecencyIndex(NOW))('recent:PROJ-1')).toBe(0);
  });
});
