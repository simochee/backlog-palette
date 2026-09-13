import { QueryClient } from '@tanstack/query-core';
import { Error as BacklogErrors } from 'backlog-js';
import { describe, expect, it, vi } from 'vitest';

import type { EntityKind } from './entries';
import { type SearchQueries, type SearchRow, type SearchScope } from './search';
import { createSearchRunner, type KindOutcome } from './searchRunner';

const HOST = 'demo.backlog.jp';
const space: SearchScope = { kind: 'space', spaceId: HOST };

const row = (kind: EntityKind, id: string): SearchRow => ({
  kind,
  id,
  title: id,
  projectName: 'p',
  url: `https://${HOST}/${id}`,
  updatedAt: 0,
  titleMatched: true,
});

type Outcomes = Record<EntityKind, () => Promise<SearchRow[]>>;

function runnerWith(outcomes: Partial<Outcomes>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const define =
    (kind: EntityKind): SearchQueries['issues'] =>
    (query, scope) => ({
      queryKey: ['backlog', scope.spaceId, 'search', kind, '*', query],
      queryFn: outcomes[kind] ?? (() => Promise.resolve([])),
      staleTime: Number.POSITIVE_INFINITY,
    });
  const queries: SearchQueries = {
    issues: define('issue'),
    wikis: define('wiki'),
    documents: define('document'),
  };
  return createSearchRunner(queryClient, queries);
}

const collect = () => {
  const reported: [EntityKind, KindOutcome][] = [];
  const report = (kind: EntityKind, outcome: KindOutcome) => {
    reported.push([kind, outcome]);
  };
  return { reported, report };
};

const settled = () =>
  new Promise<void>((done) => {
    setTimeout(done, 0);
  });

describe('検索の実行役', () => {
  it('種別ごとに結果を報告し、1 種別の失敗は他に影響しない', async () => {
    const runner = runnerWith({
      issue: () => Promise.resolve([row('issue', 'PROJ-1')]),
      wiki: () =>
        Promise.reject(
          new BacklogErrors.BacklogAuthError(new Response(null, { status: 401 }), { errors: [] }),
        ),
      document: () => Promise.resolve([]),
    });
    const { reported, report } = collect();

    runner.run('ログイン', space, report);
    await settled();

    expect(reported).toEqual(
      expect.arrayContaining([
        ['issue', { ok: true, rows: [expect.objectContaining({ id: 'PROJ-1' })] }],
        ['wiki', { ok: false, error: { kind: 'unauthorized' } }],
        ['document', { ok: true, rows: [] }],
      ]),
    );
    expect(reported).toHaveLength(3);
  });

  it('打ち切った後に届いた結果は報告しない', async () => {
    const runner = runnerWith({ issue: () => Promise.resolve([row('issue', 'PROJ-1')]) });
    const { reported, report } = collect();

    const cancel = runner.run('ログイン', space, report);
    cancel();
    await settled();

    expect(reported).toEqual([]);
  });
});

describe('検索を走らせない場面', () => {
  it('根と空の語では API を呼ばず、全種別を 0 件で揃える', () => {
    const issue = vi.fn(() => Promise.resolve([row('issue', 'PROJ-1')]));
    const runner = runnerWith({ issue });
    const { reported, report } = collect();

    runner.run('ログイン', { kind: 'root' }, report);
    runner.run('   ', space, report);

    expect(issue).not.toHaveBeenCalled();
    expect(reported.filter(([, outcome]) => outcome.ok && outcome.rows.length === 0)).toHaveLength(
      6,
    );
  });

  it('種別の条件があれば、その種別だけを走らせる', async () => {
    const wiki = vi.fn(() => Promise.resolve([]));
    const runner = runnerWith({ wiki });
    const { reported, report } = collect();

    runner.run('ログイン', space, report, {
      type: 'wiki',
      status: { kind: 'all' },
      assignee: 'all',
      updated: 'any',
    });
    await settled();

    expect(wiki).toHaveBeenCalledTimes(1);
    expect(reported.map(([kind]) => kind)).toEqual(['wiki']);
  });
});
