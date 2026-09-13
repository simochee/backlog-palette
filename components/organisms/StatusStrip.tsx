import { Button } from '@/components/atoms/Button';
import { Spinner } from '@/components/atoms/Spinner';
import { type Labels, useLabels } from '@/components/labels';
import type { SpaceProgress } from '@/components/types';
import { cn } from '@/components/utils/cn';

type StatusStripProps = {
  spaces: readonly SpaceProgress[];
  onSpaceAction: (spaceId: string) => void;
  labels?: Partial<Labels>;
};

function SpaceStatus({
  space,
  onSpaceAction,
  loadingLabel,
}: {
  space: SpaceProgress;
  onSpaceAction: (spaceId: string) => void;
  loadingLabel: string;
}) {
  return (
    <span
      data-space-id={space.id}
      data-state={space.state}
      className={cn('inline-flex items-center gap-1', space.state === 'error' && 'text-danger')}
    >
      <span className="font-medium">{space.label}</span>
      {space.state === 'loading' && (
        <>
          <Spinner className="size-3" />
          <span>{space.message ?? loadingLabel}</span>
        </>
      )}
      {space.state === 'ready' && <span>{space.count ?? 0}</span>}
      {space.state === 'error' && (
        <>
          <span>{space.message}</span>
          {space.action !== undefined && (
            <Button
              variant="ghost"
              tone="danger"
              onClick={() => onSpaceAction(space.id)}
              className="h-6 px-1.5 text-xs"
            >
              {space.action.label}
            </Button>
          )}
        </>
      )}
    </span>
  );
}

export function StatusStrip({ spaces, onSpaceAction, ...rest }: StatusStripProps) {
  const labels = useLabels(rest.labels);
  if (spaces.length === 0) return null;

  const allReady = spaces.every((space) => space.state === 'ready');
  const total = spaces.reduce((sum, space) => sum + (space.count ?? 0), 0);

  return (
    <output
      aria-label={labels.panel.statusLabel}
      className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle"
    >
      {allReady ? (
        <span>{labels.sections.summary(spaces.length, total)}</span>
      ) : (
        spaces.map((space, index) => (
          <span key={space.id} className="inline-flex items-center gap-2">
            {index > 0 && <span aria-hidden>·</span>}
            <SpaceStatus
              space={space}
              onSpaceAction={onSpaceAction}
              loadingLabel={labels.panel.loading}
            />
          </span>
        ))
      )}
    </output>
  );
}
