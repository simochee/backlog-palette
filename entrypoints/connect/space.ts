import { isBacklogSpaceOrigin } from '@/lib/backlog/host';
import { readCurrentTab } from '@/lib/tabs';

/**
 * どのスペースに繋ぐかは、このシート自身がタブ URL から決める（I7、surfaces.md §1.1）。
 * ページから postMessage で届いた origin は使わない。識別子はホスト（D-32）。
 */
export async function resolveSpaceHostFromTab(): Promise<string | undefined> {
  const tab = await readCurrentTab();
  if (tab?.url === undefined) return undefined;
  const { origin, host } = new URL(tab.url);
  return isBacklogSpaceOrigin(origin) ? host : undefined;
}
