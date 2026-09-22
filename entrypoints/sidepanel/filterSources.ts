import { useQuery } from '@tanstack/react-query';

import type { Labels } from '@/components/labels';
import type { SearchScope } from '@/lib/share';

import { backlog } from './backlog.ts';
import { projectChoices, statusChoices } from './filters.ts';

/**
 * フィルターバーの選択肢のうち、スペースのマスタから引くもの（surfaces.md §5.3）。
 * スペースを変えるとプロジェクトの選択肢が入れ替わり、プロジェクトを選ぶとそのステータスに替わる
 */
export function useFilterChoices(scope: SearchScope | undefined, labels: Labels) {
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
