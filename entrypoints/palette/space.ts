import { spaceKeyOf } from '@/lib/backlog/host';
import { readCurrentTab } from '@/lib/tabs';

/**
 * どのスペースかは拡張ページが自分のタブ URL から決める（I7）。
 * content script が open に載せた PageContext のスペースは使わない。
 */
export async function resolveSpaceFromTab(): Promise<string | undefined> {
  const tab = await readCurrentTab();
  if (tab?.url === undefined) return undefined;
  return spaceKeyOf(new URL(tab.url).origin);
}
