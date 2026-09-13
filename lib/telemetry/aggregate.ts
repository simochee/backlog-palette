/**
 * 利用状況のローカル集計（surfaces.md §10）。送るのはイベント種別と集計値だけ。
 * クエリ・件名・課題キー・URL はイベントに載せない（型が持たないので載せられない）。
 * 送信先と保持期間は人が決める（milestones.md M7）。決まるまでは集計だけをここに持つ。
 */
export type TelemetryEvent =
  | { type: 'paletteOpened' }
  /** パレットから遷移が完了した。打鍵数と、何も打たずに選んだか（空状態からの選択） */
  | { type: 'paletteNavigated'; keystrokes: number; fromEmptyState: boolean }
  | { type: 'searchStarted' }
  /** 全種別が揃って 0 件だった */
  | { type: 'searchEmpty' }
  /** 本体の全体検索へ逃げた */
  | { type: 'externalSearchOpened' }
  /** ⌘→ と panel 行 */
  | { type: 'panelHandedOff' }
  | { type: 'searchUrlCopied' }
  | { type: 'panelSearchStarted' }
  | { type: 'panelFilterChanged' };

export type DailyCounters = {
  /** UTC の日付 `yyyy-MM-dd` */
  day: string;
  paletteOpens: number;
  paletteNavigations: number;
  /** 遷移に至った起動の打鍵数の合計。平均は paletteNavigations で割る */
  keystrokesToNavigate: number;
  emptyStateSelections: number;
  searches: number;
  emptySearches: number;
  externalSearches: number;
  panelHandOffs: number;
  searchUrlCopies: number;
  panelSearches: number;
  panelFilterChanges: number;
};

export type TelemetryStore = { days: readonly DailyCounters[] };

export const EMPTY_TELEMETRY: TelemetryStore = { days: [] };

/** 保持する日数。送信先が決まったときの初期の集計単位として十分な長さ */
export const TELEMETRY_RETENTION_DAYS = 90;

export const dayOf = (now: number): string => new Date(now).toISOString().slice(0, 10);

function emptyDay(day: string): DailyCounters {
  return {
    day,
    paletteOpens: 0,
    paletteNavigations: 0,
    keystrokesToNavigate: 0,
    emptyStateSelections: 0,
    searches: 0,
    emptySearches: 0,
    externalSearches: 0,
    panelHandOffs: 0,
    searchUrlCopies: 0,
    panelSearches: 0,
    panelFilterChanges: 0,
  };
}

function apply(counters: DailyCounters, event: TelemetryEvent): DailyCounters {
  switch (event.type) {
    case 'paletteOpened':
      return { ...counters, paletteOpens: counters.paletteOpens + 1 };
    case 'paletteNavigated':
      return {
        ...counters,
        paletteNavigations: counters.paletteNavigations + 1,
        keystrokesToNavigate: counters.keystrokesToNavigate + event.keystrokes,
        emptyStateSelections: counters.emptyStateSelections + (event.fromEmptyState ? 1 : 0),
      };
    case 'searchStarted':
      return { ...counters, searches: counters.searches + 1 };
    case 'searchEmpty':
      return { ...counters, emptySearches: counters.emptySearches + 1 };
    case 'externalSearchOpened':
      return { ...counters, externalSearches: counters.externalSearches + 1 };
    case 'panelHandedOff':
      return { ...counters, panelHandOffs: counters.panelHandOffs + 1 };
    case 'searchUrlCopied':
      return { ...counters, searchUrlCopies: counters.searchUrlCopies + 1 };
    case 'panelSearchStarted':
      return { ...counters, panelSearches: counters.panelSearches + 1 };
    case 'panelFilterChanged':
      return { ...counters, panelFilterChanges: counters.panelFilterChanges + 1 };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

/** 1 イベントを当日のカウンタに足す。保持日数を超えた日は落とす。日は新しいものが先頭 */
export function record(
  store: TelemetryStore,
  event: TelemetryEvent,
  now: number,
  retentionDays: number = TELEMETRY_RETENTION_DAYS,
): TelemetryStore {
  const today = dayOf(now);
  const current = store.days.find((d) => d.day === today) ?? emptyDay(today);
  const oldest = dayOf(now - retentionDays * 24 * 60 * 60 * 1000);
  const others = store.days.filter((d) => d.day !== today && d.day >= oldest);
  return {
    days: [apply(current, event), ...others].toSorted((a, b) => (a.day < b.day ? 1 : -1)),
  };
}
