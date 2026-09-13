import { describe, expect, it } from 'vitest';

import type { IssueLike } from './entries';
import { defaultConditions, kindsFor, planIssueSearch } from './filters';

const context = {
  statusesByProject: {
    '101': [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 10101 }],
    '102': [{ id: 1 }, { id: 4 }],
  },
  myselfId: 7,
  now: Date.UTC(2026, 8, 13, 12),
};

const issue = (assignee?: string): IssueLike => ({
  projectId: 101,
  issueKey: 'PROJ-1',
  summary: 's',
  issueType: { name: 't', color: '#666665' },
  status: { id: 1, name: '未対応' },
  ...(assignee === undefined ? {} : { assignee: { name: assignee } }),
  updatedUser: { name: 'u' },
  updated: '2026-09-10T00:00:00Z',
});

describe('パネルの条件の展開', () => {
  it('条件が無ければパラメータは空で、すべての課題が残る', () => {
    const plan = planIssueSearch(defaultConditions, context);

    expect(plan.params).toEqual({});
    expect(plan.postFilter(issue('田中'))).toBe(true);
  });

  it('「完了を除く」はプロジェクトごとの statusId 集合に展開されて合併される', () => {
    const plan = planIssueSearch({ ...defaultConditions, status: { kind: 'notClosed' } }, context);

    expect(plan.params.statusId).toEqual([1, 2, 10101]);
  });

  it('担当者「自分」は自分の ID、「未設定」は取った後に担当者の無い課題だけを残す', () => {
    const me = planIssueSearch({ ...defaultConditions, assignee: 'me' }, context);
    const unassigned = planIssueSearch({ ...defaultConditions, assignee: 'unassigned' }, context);

    expect(me.params.assigneeId).toEqual([7]);
    expect(unassigned.params).not.toHaveProperty('assigneeId');
    expect(unassigned.postFilter(issue())).toBe(true);
    expect(unassigned.postFilter(issue('田中'))).toBe(false);
  });

  it('更新日の範囲は今日から日数を引いた yyyy-MM-dd になる', () => {
    expect(planIssueSearch({ ...defaultConditions, updated: 'week' }, context).params).toEqual({
      updatedSince: '2026-09-06',
    });
    expect(
      planIssueSearch({ ...defaultConditions, updated: 'quarter' }, context).params.updatedSince,
    ).toBe('2026-06-15');
  });

  it('種別の条件は走らせる種別を絞る', () => {
    expect(kindsFor('all')).toEqual(['issue', 'wiki', 'document']);
    expect(kindsFor('wiki')).toEqual(['wiki']);
  });
});
