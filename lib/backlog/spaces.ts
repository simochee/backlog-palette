import type { ConnectedSpace } from '@/lib/connect/connectSpace';

/**
 * 接続済みスペースの出入り。鍵・記録・レート状態はそれぞれ別の item にあり、
 * 1 つの操作で揃えて動かす。storage は引数で受け、node で検査する。
 */
export type SpaceStores = {
  removeApiKey: (host: string) => Promise<void>;
  spaces: {
    load: () => Promise<readonly ConnectedSpace[]>;
    save: (spaces: readonly ConnectedSpace[]) => Promise<void>;
  };
  removeRateLimit: (host: string) => Promise<void>;
  /** その host の Query キャッシュを捨てる。拡張ページごとの QueryClient を持つ側が渡す */
  dropQueries?: (host: string) => void;
};

export async function disconnectSpace(host: string, stores: SpaceStores): Promise<void> {
  // 鍵を先に消す。以降の API 呼び出しは NotConnectedError で止まり、未接続の行になる
  await stores.removeApiKey(host);
  const known = await stores.spaces.load();
  await stores.spaces.save(known.filter((space) => space.host !== host));
  await stores.removeRateLimit(host);
  stores.dropQueries?.(host);
}

/** 401 を受けたら記録に印を付ける。鍵は消さない（再接続まで未接続の行ではなく再接続の行を出す） */
export async function markNeedsReconnect(
  host: string,
  stores: Pick<SpaceStores, 'spaces'>,
  needsReconnect = true,
): Promise<void> {
  const known = await stores.spaces.load();
  const flagged = (space: ConnectedSpace): ConnectedSpace => ({ ...space, needsReconnect });
  await stores.spaces.save(known.map((space) => (space.host === host ? flagged(space) : space)));
}
