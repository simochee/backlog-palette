import { useLiveSuspenseQuery } from '@tanstack/react-db';

import { SpaceList } from '@/components/organisms/SpaceList';
import { navigate } from '@/lib/tabs';

import { connectedSpaces, disconnectSpace, reconnectUrl, toSpaceItems } from './spaces.ts';

/** 読み込み前は Suspense で待つ。0 件の案内を先に出すと、一瞬「未接続」に見える */
export function SpacesSection() {
  const { data } = useLiveSuspenseQuery((q) =>
    q.from({ space: connectedSpaces }).orderBy(({ space }) => space.connectedAt, 'desc'),
  );
  return (
    <SpaceList
      spaces={toSpaceItems(data)}
      onReconnect={(host) => void navigate(reconnectUrl(host), 'new')}
      onDisconnect={(host) => void disconnectSpace(host)}
    />
  );
}
