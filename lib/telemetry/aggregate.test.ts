import { describe, expect, it } from 'vitest';

import { EMPTY_TELEMETRY, record, type TelemetryEvent } from './aggregate';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 13, 12);

const play = (events: TelemetryEvent[], at = now) =>
  events.reduce((store, event) => record(store, event, at), EMPTY_TELEMETRY);

describe('利用状況の集計', () => {
  it('起動と遷移を日ごとに数え、遷移の打鍵数と空状態からの選択を積む', () => {
    const store = play([
      { type: 'paletteOpened' },
      { type: 'paletteOpened' },
      { type: 'paletteNavigated', keystrokes: 3, fromEmptyState: false },
      { type: 'paletteNavigated', keystrokes: 0, fromEmptyState: true },
    ]);

    expect(store.days).toEqual([
      expect.objectContaining({
        day: '2026-09-13',
        paletteOpens: 2,
        paletteNavigations: 2,
        keystrokesToNavigate: 3,
        emptyStateSelections: 1,
      }),
    ]);
  });

  it('検索の起動・0 件・本体検索への逃げ・⌘→・URL コピー・パネルの検索と条件変更を数える', () => {
    const store = play([
      { type: 'searchStarted' },
      { type: 'searchStarted' },
      { type: 'searchEmpty' },
      { type: 'externalSearchOpened' },
      { type: 'panelHandedOff' },
      { type: 'searchUrlCopied' },
      { type: 'panelSearchStarted' },
      { type: 'panelFilterChanged' },
      { type: 'panelFilterChanged' },
    ]);

    expect(store.days[0]).toMatchObject({
      searches: 2,
      emptySearches: 1,
      externalSearches: 1,
      panelHandOffs: 1,
      searchUrlCopies: 1,
      panelSearches: 1,
      panelFilterChanges: 2,
    });
  });

});

describe('集計の日付', () => {
  it('日が変わると別のカウンタになり、新しい日が先頭に来る', () => {
    const yesterday = record(EMPTY_TELEMETRY, { type: 'paletteOpened' }, now - DAY);
    const store = record(yesterday, { type: 'paletteOpened' }, now);

    expect(store.days.map((d) => [d.day, d.paletteOpens])).toEqual([
      ['2026-09-13', 1],
      ['2026-09-12', 1],
    ]);
  });

  it('保持日数を超えた日は落ちる', () => {
    const old = record(EMPTY_TELEMETRY, { type: 'paletteOpened' }, now - 91 * DAY);
    const store = record(old, { type: 'paletteOpened' }, now);

    expect(store.days.map((d) => d.day)).toEqual(['2026-09-13']);
  });
});
