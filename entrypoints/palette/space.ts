import { spaceHostOf } from '@/lib/backlog/host';
import { readCurrentTab } from '@/lib/tabs';

/**
 * どのスペースかは拡張ページが自分のタブ URL から決める（I7）。識別子はホスト名（D-32）。
 * content script が open に載せた PageContext のスペースは使わない。
 */
export async function resolveSpaceFromTab(): Promise<string | undefined> {
  const tab = await readCurrentTab();
  if (tab?.url === undefined) return undefined;
  return spaceHostOf(new URL(tab.url).origin);
}
