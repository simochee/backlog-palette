import { en, ja, type Labels } from '@/components/labels';
import { spaceHostOf } from '@/lib/backlog/host';
import type { ConnectedSpace } from '@/lib/connect/connectSpace';
import { resolveLanguage } from '@/lib/i18n/language';
import type { SearchScope } from '@/lib/share';
import { spaces } from '@/lib/storage/items';
import { type SearchHistoryRecord, searchHistory, settings } from '@/lib/storage/palette-items';
import { readCurrentTab } from '@/lib/tabs';
import { applyColorScheme } from '@/lib/theme/colorScheme';

export type PanelContext = {
  labels: Labels;
  /** アクティブなタブのスペース。Backlog のタブでなければ undefined */
  tabSpace: string | undefined;
  spaces: readonly ConnectedSpace[];
  learningEnabled: boolean;
};

/** どのスペースかはタブ URL から決める（I7）。パネルはタブに属さないのでアクティブなタブを読む */
export async function readPanelContext(): Promise<PanelContext> {
  const [tab, prefs, connected] = await Promise.all([
    readCurrentTab(),
    settings.getValue(),
    spaces.getValue(),
  ]);
  const language = resolveLanguage(prefs.language, navigator.language);
  applyColorScheme(
    document.documentElement,
    prefs.theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const tabSpace = tab?.url === undefined ? undefined : spaceHostOf(new URL(tab.url).origin);
  return {
    labels: language === 'ja' ? ja : en,
    tabSpace,
    spaces: connected,
    learningEnabled: prefs.learning,
  };
}

/*
 * 開いた時点で 1 度だけ読む。検索を変えるたびに読み直すと、別のタブへ移ったときに
 * 既定のスコープが勝手に変わる。route の beforeLoad と container が同じ promise を読む
 */
let opened: Promise<PanelContext> | undefined;
export const readPanelContextOnce = (): Promise<PanelContext> => (opened ??= readPanelContext());

export const RECENT_QUERY_LIMIT = 5;
const HISTORY_LIMIT = 50;

/** 最近の検索はスペースごと（D-20）。新しいものが先頭、同じ語は 1 つ */
export function recentQueriesFor(
  history: readonly SearchHistoryRecord[],
  scope: SearchScope | undefined,
): string[] {
  if (scope === undefined) return [];
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const record of history) {
    if (record.scope.spaceId !== scope.spaceId || seen.has(record.query)) continue;
    seen.add(record.query);
    queries.push(record.query);
    if (queries.length === RECENT_QUERY_LIMIT) break;
  }
  return queries;
}

export function pushHistory(
  history: readonly SearchHistoryRecord[],
  record: SearchHistoryRecord,
): SearchHistoryRecord[] {
  const rest = history.filter(
    (h) => !(h.query === record.query && h.scope.spaceId === record.scope.spaceId),
  );
  return [record, ...rest].slice(0, HISTORY_LIMIT);
}

export async function recordSearch(query: string, scope: SearchScope, at: number): Promise<void> {
  const history = await searchHistory.getValue();
  await searchHistory.setValue(pushHistory(history, { query, scope, at }));
}
