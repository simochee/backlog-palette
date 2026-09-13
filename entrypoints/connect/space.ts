import { spaceHostOfUrl } from '@/lib/backlog/spaceOrigins';
import { readCurrentTab } from '@/lib/tabs';

/**
 * どのスペースに繋ぐかは、このシート自身がタブ URL から決める（I7、surfaces.md §1.1）。
 * ページから postMessage で届いた origin は使わない。識別子はホスト（D-32）。
 * カスタムドメイン（§8）は登録済みのものだけをスペースと見る。
 */
export async function resolveSpaceHostFromTab(): Promise<string | undefined> {
  const tab = await readCurrentTab();
  if (tab?.url === undefined) return undefined;
  return spaceHostOfUrl(tab.url);
}
