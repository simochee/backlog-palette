import { SpaceList } from '@/components/organisms/SpaceList';
import { spaces } from '@/lib/storage/items';
import { navigate } from '@/lib/tabs';

import { disconnectSpace, reconnectUrl, toSpaceItems } from './spaces.ts';
import { useStorageItem } from './useStorageItem.ts';

export function SpacesSection() {
  const stored = useStorageItem(spaces);
  // 読み込み前に 0 件の案内を出さない。一瞬「未接続」に見えるのを避ける
  if (stored === undefined) return null;
  return (
    <SpaceList
      spaces={toSpaceItems(stored)}
      onReconnect={(host) => void navigate(reconnectUrl(host), 'new')}
      onDisconnect={(host) => void disconnectSpace(host)}
    />
  );
}
