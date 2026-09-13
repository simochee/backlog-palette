import type { SpaceItemView } from '@/components/types';

import { spaces } from './domain';

export const spaceItems: SpaceItemView[] = [
  {
    id: spaces.nulab.id,
    label: spaces.nulab.label,
    host: spaces.nulab.host,
    projectCount: 12,
    lastSyncedAt: '3 分前',
    method: 'apiKey',
    state: 'connected',
  },
  {
    id: spaces.acme.id,
    label: spaces.acme.label,
    host: spaces.acme.host,
    projectCount: 4,
    lastSyncedAt: '昨日',
    method: 'oauth',
    state: 'connected',
  },
  {
    id: spaces.beta.id,
    label: spaces.beta.label,
    host: spaces.beta.host,
    projectCount: 1,
    lastSyncedAt: '2 週間前',
    method: 'apiKey',
    state: 'connected',
  },
];

export const spaceItemsWithExpired: SpaceItemView[] = spaceItems.map((space) =>
  space.id === spaces.beta.id
    ? {
        id: space.id,
        label: space.label,
        host: space.host,
        projectCount: space.projectCount,
        lastSyncedAt: space.lastSyncedAt,
        method: space.method,
        state: 'needsReconnect',
      }
    : space,
);

export const customHosts = ['backlog.example.co.jp', 'pm.example.com'];
