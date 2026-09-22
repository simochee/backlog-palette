import { useQuery } from '@tanstack/react-query';

import type { Labels } from '@/components/labels';
import type { FilterField } from '@/components/types';
import type { SearchScope } from '@/lib/share';

import { backlog } from './backlog.ts';
import type { PanelContext } from './context.ts';
import { buildFilters, projectChoices, statusChoices } from './filters.ts';
import type { PanelSearch } from './searchParams.ts';

/**
 * フィルターバーの選択肢のうち、スペースのマスタから引くもの（surfaces.md §5.3）。
 * スペースを変えるとプロジェクトの選択肢が入れ替わり、プロジェクトを選ぶとそのステータスに替わる
 */
function useFilterChoices(scope: SearchScope | undefined, labels: Labels) {
  const host = scope?.spaceId ?? '';
  const projects = useQuery({ ...backlog.queries.projects(host), enabled: host !== '' });
  const project =
    scope?.kind === 'project'
      ? projects.data?.find((p) => p.projectKey === scope.projectId)
      : undefined;
  const statuses = useQuery({
    ...backlog.queries.statuses(host, project?.id ?? 0),
    enabled: project !== undefined,
  });
  return {
    projects: projectChoices(projects.data ?? []),
    statuses: statusChoices(project === undefined ? undefined : statuses.data, labels),
  };
}

export function usePanelFilters(search: PanelSearch, context: PanelContext): FilterField[] {
  const choices = useFilterChoices(search.scope, context.labels);
  return buildFilters(search, context.labels, {
    spaces: context.spaces,
    tabSpace: context.tabSpace,
    ...choices,
  });
}
