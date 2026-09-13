import { customHosts } from '@/lib/storage/options-items';

import { isBacklogSpaceOrigin } from './host';

/** 静的な 3 ドメインと登録済みカスタムドメイン（surfaces.md §8）のどちらかなら true */
export async function isKnownSpaceOrigin(origin: string): Promise<boolean> {
  return isBacklogSpaceOrigin(origin, await customHosts.getValue());
}

/** URL がスペースのものならホスト（D-32 の識別子）、でなければ undefined */
export async function spaceHostOfUrl(url: string): Promise<string | undefined> {
  const parsed = URL.parse(url);
  if (parsed === null) return undefined;
  return (await isKnownSpaceOrigin(parsed.origin)) ? parsed.host : undefined;
}
