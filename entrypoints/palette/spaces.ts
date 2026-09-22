import { connectedSpaceHosts, watchConnectedSpaceHosts } from '@/lib/backlog/apiKeys';
import { spaces } from '@/lib/storage/items';

import type { SpaceLabel } from './context.ts';

/** 接続済みスペースの表示名と印。鍵は読まない（鍵の有無だけを apiKeys から引く、I7） */
export type ConnectedSpaces = ReadonlyMap<string, SpaceLabel>;

/**
 * 「接続済み」の根拠は鍵の有無（apiKeys）で、spaces の記録は表示名と印の出典。
 * 記録が無い（接続直後に初期化が失敗した）ホストはホスト名を表示名にして残す
 */
export async function readConnectedSpaces(): Promise<ConnectedSpaces> {
  const [hosts, records] = await Promise.all([connectedSpaceHosts(), spaces.getValue()]);
  const map = new Map<string, SpaceLabel>();
  for (const host of hosts) {
    const record = records.find((space) => space.host === host);
    map.set(host, { name: record?.name ?? host, icon: record?.icon });
  }
  return map;
}

/** 接続の成立・解除と、表示名・印の更新を知らせる */
export function watchConnectedSpaces(onChange: () => void): () => void {
  const unwatchHosts = watchConnectedSpaceHosts(onChange);
  const unwatchRecords = spaces.watch(() => onChange());
  return () => {
    unwatchHosts();
    unwatchRecords();
  };
}
