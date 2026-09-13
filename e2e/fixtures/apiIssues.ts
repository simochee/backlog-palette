import type { FakeApi } from './api.ts';
import { type FakeIssue, ISSUES, STATUSES, TESTER } from './apiData.ts';

export type IssueUpdate = { summary?: string; statusId?: number; assignee?: string };

/** テストが書いた「その後の変更」を重ねた今の課題 */
function withUpdate(issue: FakeIssue, update: IssueUpdate | undefined): FakeIssue {
  if (update === undefined) return issue;
  const statusRow =
    update.statusId === undefined
      ? issue.status
      : (STATUSES[issue.projectId]?.find((s) => s.id === update.statusId) ?? issue.status);
  return {
    ...issue,
    summary: update.summary ?? issue.summary,
    status: statusRow,
    assignee: update.assignee === undefined ? issue.assignee : { ...TESTER, name: update.assignee },
  };
}

export function currentIssues(api: FakeApi): FakeIssue[] {
  return ISSUES.map((issue) => withUpdate(issue, api.issueUpdates[issue.issueKey]));
}
