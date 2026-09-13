import { useState } from 'react';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SpaceBadge } from '@/components/atoms/SpaceBadge';
import { type Labels, useLabels } from '@/components/labels';
import type { SpaceItemView } from '@/components/types';

type SpaceListProps = {
  spaces: readonly SpaceItemView[];
  onReconnect: (spaceId: string) => void;
  onDisconnect: (spaceId: string) => void;
  labels?: Partial<Labels>;
};

function SpaceItem({
  space,
  confirming,
  onReconnect,
  onDisconnectPress,
  labels,
}: {
  space: SpaceItemView;
  confirming: boolean;
  onReconnect: () => void;
  onDisconnectPress: () => void;
  labels: Labels;
}) {
  const needsReconnect = space.state === 'needsReconnect';
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <SpaceBadge label={space.label} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{space.label}</span>
          <Badge
            label={needsReconnect ? labels.options.needsReconnect : labels.options.connected}
            tone={needsReconnect ? 'danger' : 'success'}
            dot
          />
        </div>
        <p className="truncate text-sm text-subtle">
          {space.host} · {labels.options.projects(space.projectCount)} ·{' '}
          {labels.options.lastSync(space.lastSyncedAt)} · {labels.options.method[space.method]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {needsReconnect && (
          <Button variant="secondary" onClick={onReconnect}>
            {labels.options.reconnect}
          </Button>
        )}
        <Button
          variant={confirming ? 'primary' : 'ghost'}
          tone="danger"
          onClick={onDisconnectPress}
          aria-label={`${confirming ? labels.options.confirmDisconnect : labels.options.disconnect}: ${space.label}`}
        >
          {confirming ? labels.options.confirmDisconnect : labels.options.disconnect}
        </Button>
      </div>
    </li>
  );
}

export function SpaceList({ spaces, onReconnect, onDisconnect, ...rest }: SpaceListProps) {
  const labels = useLabels(rest.labels);
  const [confirmingId, setConfirmingId] = useState<string>();

  if (spaces.length === 0) {
    return <p className="py-3 text-sm text-subtle">{labels.options.spacesEmpty}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {spaces.map((space) => (
        <SpaceItem
          key={space.id}
          space={space}
          confirming={confirmingId === space.id}
          onReconnect={() => onReconnect(space.id)}
          onDisconnectPress={() => {
            if (confirmingId === space.id) {
              setConfirmingId(undefined);
              onDisconnect(space.id);
            } else {
              setConfirmingId(space.id);
            }
          }}
          labels={labels}
        />
      ))}
    </ul>
  );
}
