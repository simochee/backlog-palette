import type { ReactNode } from 'react';

import { useNarrowerThan } from '@/components/hooks/useNarrowerThan';

type PanelLayoutProps = {
  input: ReactNode;
  recent?: ReactNode;
  filters: ReactNode;
  status?: ReactNode;
  list: ReactNode;
  footer: ReactNode;
  'aria-label': string;
};

/**
 * サイドパネルの縦積み配置（surfaces.md §5.2）。幅が --bp-breakpoint-panel-compact 未満のとき
 * data-compact を立て、子はコンテナクエリではなく in-data-compact で密度を変える。
 */
export function PanelLayout({
  input,
  recent,
  filters,
  status,
  list,
  footer,
  ...aria
}: PanelLayoutProps) {
  const [compact, rootRef] = useNarrowerThan('--bp-breakpoint-panel-compact');

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={aria['aria-label']}
      data-compact={compact ? true : undefined}
      className="@container flex h-full min-h-0 flex-col bg-floating font-body text-default"
    >
      <div className="flex flex-col gap-2 border-b border-border px-3 pt-3 pb-2">
        {input}
        {recent}
        {filters}
        {status}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
      <div className="h-(--bp-size-footer) shrink-0 border-t border-border">{footer}</div>
    </div>
  );
}
