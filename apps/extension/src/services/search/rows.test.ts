import { describe, expect, it } from 'vitest';
import type { BacklogIssue, BacklogProject } from '../backlog/types.ts';
import { issueRow, orderRows, type SearchRow } from './rows.ts';

const USER = { id: 7, name: '田中' };
const CTX = { spaceKey: 'nulab', host: 'nulab.backlog.jp' };

const PROJECT: BacklogProject = {
  id: 1,
  projectKey: 'PROJ',
  name: 'パレット',
  archived: false,
  displayOrder: 0,
  useWiki: true,
};

function issue(overrides: Partial<BacklogIssue> = {}): BacklogIssue {
  return {
    id: 1,
    projectId: 1,
    issueKey: 'PROJ-1',
    keyId: 1,
    summary: '検索の設計',
    description: '本文',
    issueType: { id: 1, projectId: 1, name: 'バグ', color: '#990000' },
    status: { id: 2, projectId: 1, name: '処理中', color: '#4488c5', displayOrder: 2000 },
    priority: { id: 2, name: '中' },
    createdUser: USER,
    created: '2026-09-01T00:00:00Z',
    updatedUser: USER,
    updated: '2026-09-09T00:00:00Z',
    ...overrides,
  };
}

function row(id: string, spaceKey: string, updatedAt: number): SearchRow {
  return { id, kind: 'issue', title: id, url: `https://${spaceKey}/`, updatedAt, spaceKey };
}

describe('結果の行', () => {
  it('課題はキーと状態と種別を持ち、課題ページへ遷移する', () => {
    const built = issueRow(issue(), PROJECT, CTX);

    expect(built).toMatchObject({
      kind: 'issue',
      code: 'PROJ-1',
      title: '検索の設計',
      sub: 'パレット',
      marker: { label: '処理中', tone: 'info' },
      tag: { label: 'バグ', tone: 'danger' },
      url: 'https://nulab.backlog.jp/view/PROJ-1',
      spaceKey: 'nulab',
    });
  });

  it('更新日時はエポックミリ秒で持つ', () => {
    expect(issueRow(issue(), PROJECT, CTX).updatedAt).toBe(Date.parse('2026-09-09T00:00:00Z'));
  });

  it('担当者がいなければアバターを付けない', () => {
    expect(issueRow(issue({ assignee: null }), PROJECT, CTX).avatar).toBeUndefined();
  });

  it('スペースをまたいで同じ id にならない', () => {
    const other = issueRow(issue(), PROJECT, { spaceKey: 'acme', host: 'acme.backlog.jp' });

    expect(issueRow(issue(), PROJECT, CTX).id).not.toBe(other.id);
  });
});

describe('チャンク内の並び', () => {
  it('現在のスペースの行が先に来る', () => {
    const ordered = orderRows([row('a', 'acme', 200), row('b', 'nulab', 100)], 'nulab');

    expect(ordered.map((each) => each.id)).toEqual(['b', 'a']);
  });

  it('同じスペースなら更新日時の新しい順に並ぶ', () => {
    const ordered = orderRows([row('old', 'nulab', 100), row('new', 'nulab', 200)], 'nulab');

    expect(ordered.map((each) => each.id)).toEqual(['new', 'old']);
  });

  it('現在のスペースが分からないときは更新日時だけで並ぶ', () => {
    const ordered = orderRows([row('old', 'acme', 100), row('new', 'nulab', 200)], undefined);

    expect(ordered.map((each) => each.id)).toEqual(['new', 'old']);
  });
});
