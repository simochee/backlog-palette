import { statusBadge } from '@/lib/backlog/entries';
import type { Language } from '@/lib/i18n/language';
import { navIndex } from '@/lib/nav';
import {
  type CachedEntry,
  type CurrentIssue,
  entityId,
  type PaletteIndex,
  type ProjectEntry,
  type SpaceEntry,
} from '@/lib/palette';
import type { ActivityEvent } from '@/lib/rank';
import { type DisplayCacheEntry, displayCache } from '@/lib/storage/items';
import { activity, queryDict, type Settings, transitions } from '@/lib/storage/palette-items';

import type { OpenContext } from './context.ts';
import type { ConnectedSpaces } from './spaces.ts';

const originOf = (host: string) => `https://${host}`;

function cachedEntryOf(entry: DisplayCacheEntry): CachedEntry | undefined {
  if (entry.kind === 'project' || entry.key === undefined) return undefined;
  return {
    kind: entry.kind,
    id: entry.key,
    key: entry.kind === 'issue' ? entry.key : undefined,
    title: entry.title ?? entry.key,
    spaceId: entry.spaceHost,
    projectId: entry.projectKey,
    projectName: entry.projectKey,
    ...(entry.assignee === undefined ? {} : { assignee: entry.assignee }),
    ...(entry.status === undefined ? {} : { status: statusBadge(entry.status) }),
    url: entry.url,
  };
}

/*
 * プロジェクトはマスタ（M4）が届くまで表示キャッシュに現れたキーから起こす。
 * id はキー（context.ts の projectSegmentOf と同じ約束）
 */
function projectsOf(cache: readonly DisplayCacheEntry[], context: OpenContext): ProjectEntry[] {
  const keys = new Map<string, string>();
  for (const entry of cache) keys.set(`${entry.spaceHost}/${entry.projectKey}`, entry.spaceHost);
  if (context.projectKey !== undefined)
    keys.set(`${context.spaceHost}/${context.projectKey}`, context.spaceHost);
  return [...keys].map(([composite, spaceId]) => {
    const key = composite.slice(spaceId.length + 1);
    return { id: key, key, name: key, spaceId, url: `${originOf(spaceId)}/projects/${key}` };
  });
}

function spacesOf(connected: ConnectedSpaces, context: OpenContext): SpaceEntry[] {
  const hosts = new Set([...connected.keys(), context.spaceHost]);
  return [...hosts].map((host) => {
    const label = connected.get(host);
    return {
      id: host,
      label: label?.name ?? host,
      host,
      icon: label?.icon,
      connected: connected.has(host),
      url: `${originOf(host)}/dashboard`,
    };
  });
}

/** 表示キャッシュの訪問も 1 回の行動として数える。パレットを使う前から「最近開いた」が埋まる */
function visitsAsActivity(cache: readonly DisplayCacheEntry[]): ActivityEvent[] {
  return cache.flatMap((entry) =>
    entry.kind === 'project' || entry.key === undefined
      ? []
      : [{ entityId: entityId(entry.kind, entry.key), at: entry.visitedAt }],
  );
}

function currentIssueOf(
  cache: readonly DisplayCacheEntry[],
  context: OpenContext,
): CurrentIssue | undefined {
  const key = context.issueKey;
  const url = `${context.origin}${context.pathname}`;
  const visited = cache.find((entry) => entry.url === url);
  return key === undefined ? undefined : { key, title: visited?.title ?? key, url };
}

export type IndexInput = {
  context: OpenContext;
  connected: ConnectedSpaces;
  settings: Settings;
  language: Language;
  now: number;
};

/** 開いた瞬間に storage から索引を組む。API 応答は待たない（palette.md §3）。担当課題は M4 が足す */
export async function buildIndex(input: IndexInput): Promise<PaletteIndex> {
  const { context, connected, settings, language, now } = input;
  const [cache, log, history, learned] = await Promise.all([
    displayCache.getValue(),
    activity.getValue(),
    transitions.getValue(),
    queryDict.getValue(),
  ]);
  const urls = navIndex({ originOf, projectKeyOf: (id) => id, language });
  return {
    ...urls,
    spaces: spacesOf(connected, context),
    projects: projectsOf(cache, context),
    cache: cache.flatMap((entry) => cachedEntryOf(entry) ?? []),
    assigned: undefined,
    activity: [...log, ...visitsAsActivity(cache)],
    transitions: history,
    queryDict: learned,
    currentPageKind: context.pageKind,
    currentUrl: `${context.origin}${context.pathname}`,
    currentIssue: currentIssueOf(cache, context),
    learningEnabled: settings.learning,
    now,
  };
}
