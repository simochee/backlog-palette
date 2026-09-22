import { Button } from '@/components/atoms/Button';
import { Spinner } from '@/components/atoms/Spinner';
import { type Labels, useLabels } from '@/components/labels';
import type { SearchProgress } from '@/components/types';
import { cn } from '@/components/utils/cn';

type StatusStripProps = {
  progress: readonly SearchProgress[];
  onProgressAction: (id: string) => void;
  labels?: Partial<Labels>;
};

function ProgressItem({
  item,
  onAction,
  loadingLabel,
}: {
  item: SearchProgress;
  onAction: (id: string) => void;
  loadingLabel: string;
}) {
  return (
    <span
      data-progress-id={item.id}
      data-state={item.state}
      className={cn('inline-flex items-center gap-1', item.state === 'error' && 'text-danger')}
    >
      <span className="font-medium">{item.label}</span>
      {item.state === 'loading' && (
        <>
          <Spinner className="size-3" />
          <span>{item.message ?? loadingLabel}</span>
        </>
      )}
      {item.state === 'ready' && <span>{item.count ?? 0}</span>}
      {item.state === 'error' && (
        <>
          <span>{item.message}</span>
          {item.action !== undefined && (
            <Button
              variant="secondary"
              tone="danger"
              onClick={() => onAction(item.id)}
              className="h-5 px-1.5 text-xs"
            >
              {item.action.label}
            </Button>
          )}
        </>
      )}
    </span>
  );
}

/** 種別（課題・Wiki・ドキュメント）ごとの進捗。リストの外に固定し、全部揃ったら件数だけに畳む */
export function StatusStrip({ progress, onProgressAction, ...rest }: StatusStripProps) {
  const labels = useLabels(rest.labels);
  if (progress.length === 0) return null;

  const allReady = progress.every((item) => item.state === 'ready');
  const allLoading = progress.every((item) => item.state === 'loading');
  const total = progress.reduce((sum, item) => sum + (item.count ?? 0), 0);

  return (
    <output
      aria-label={labels.panel.statusLabel}
      className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle"
    >
      {allReady ? (
        <span>{labels.sections.count(total)}</span>
      ) : allLoading ? (
        // 種別ごとに分けても全部同じ語になる。3 つ並べても増える情報は無い（D-49）
        <span className="inline-flex items-center gap-1.5">
          <Spinner className="size-3" />
          {labels.panel.loading}
        </span>
      ) : (
        progress.map((item, index) => (
          <span key={item.id} className="inline-flex items-center gap-2">
            {index > 0 && <span aria-hidden>·</span>}
            <ProgressItem
              item={item}
              onAction={onProgressAction}
              loadingLabel={labels.panel.loading}
            />
          </span>
        ))
      )}
    </output>
  );
}
