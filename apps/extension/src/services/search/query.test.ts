import { defaultSearchState, type SearchState } from '@backlog-palette/core';
import { describe, expect, it } from 'vitest';
import { documentParams, issueParams, rowFilter, wantsType } from './query.ts';
import type { SearchRow } from './rows.ts';

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function state(overrides: Partial<SearchState> = {}): SearchState {
  return { ...defaultSearchState, query: '設計', ...overrides };
}

function row(overrides: Partial<SearchRow> = {}): SearchRow {
  return {
    id: 'nulab:issue:1',
    kind: 'issue',
    title: '見出し',
    url: 'https://nulab.backlog.jp/view/PROJ-1',
    updatedAt: NOW,
    spaceKey: 'nulab',
    ...overrides,
  };
}

describe('引く種別の決定', () => {
  it('Wiki はキーワードがあるときだけ引く', () => {
    expect(wantsType(state({ query: '' }), 'wiki')).toBe(false);
    expect(wantsType(state(), 'wiki')).toBe(true);
  });

  it('ドキュメントはキーワードが無くても引ける', () => {
    expect(wantsType(state({ query: '' }), 'document')).toBe(true);
  });

  it('選ばれていない種別は引かない', () => {
    expect(wantsType(state({ types: ['issue'] }), 'wiki')).toBe(false);
    expect(wantsType(state({ types: ['issue'] }), 'issue')).toBe(true);
  });

  it('課題にしかない条件で絞ったら課題だけを引く', () => {
    const filtered = state({ status: { kind: 'preset', preset: 'openOnly' } });

    expect(wantsType(filtered, 'issue')).toBe(true);
    expect(wantsType(filtered, 'wiki')).toBe(false);
    expect(wantsType(filtered, 'document')).toBe(false);
  });
});

describe('課題の検索条件', () => {
  it('更新日の絞り込みは期間の始まりの日付として渡す', () => {
    const params = issueParams({
      state: state({ updated: { kind: 'withinDays', days: 7 } }),
      projectId: [1],
      assigneeId: undefined,
      now: NOW,
    });

    expect(params.updatedSince).toBe('2026-09-03');
  });

  it('「完了を除く」は未完了のステータスを列挙して渡す', () => {
    const params = issueParams({
      state: state({ status: { kind: 'preset', preset: 'openOnly' } }),
      projectId: [1],
      assigneeId: undefined,
      now: NOW,
    });

    expect(params.statusId).toEqual([1, 2, 3]);
  });

  it('条件を選んでいなければ、その条件は送らない', () => {
    const params = issueParams({ state: state(), projectId: [1], assigneeId: undefined, now: NOW });

    expect(params.statusId).toBeUndefined();
    expect(params.assigneeId).toBeUndefined();
    expect(params.updatedSince).toBeUndefined();
  });

  it('更新の新しい順に、上限を付けて引く', () => {
    const params = issueParams({ state: state(), projectId: [1], assigneeId: undefined, now: NOW });

    expect(params).toMatchObject({ sort: 'updated', order: 'desc' });
    expect(params.count).toBeGreaterThan(0);
  });

  it('ドキュメントは先頭から更新の新しい順に引く', () => {
    expect(documentParams(state(), [1, 2])).toMatchObject({
      projectIds: [1, 2],
      offset: 0,
      sort: 'updated',
      order: 'desc',
      keyword: '設計',
    });
  });
});

describe('取得後の絞り込み', () => {
  it('キーワード対象が件名なら、本文だけが一致する行は落ちる', () => {
    const keep = rowFilter(state(), NOW);

    expect(keep(row({ title: '設計の見直し' }))).toBe(true);
    expect(keep(row({ title: '見出し', body: '設計の話' }))).toBe(false);
  });

  it('件名・本文を選べば本文の一致も残る', () => {
    const keep = rowFilter(state({ keywordTarget: 'subjectAndBody' }), NOW);

    expect(keep(row({ title: '見出し', body: '設計の話' }))).toBe(true);
  });

  it('コメントまで含めるなら、API が返した行をそのまま通す', () => {
    const keep = rowFilter(state({ keywordTarget: 'subjectBodyAndComment' }), NOW);

    expect(keep(row({ title: '見出し' }))).toBe(true);
  });

  it('更新日で絞ると、期間より古い行は落ちる', () => {
    const keep = rowFilter(
      state({ keywordTarget: 'subjectBodyAndComment', updated: { kind: 'withinDays', days: 7 } }),
      NOW,
    );

    expect(keep(row({ updatedAt: NOW - 6 * DAY }))).toBe(true);
    expect(keep(row({ updatedAt: NOW - 8 * DAY }))).toBe(false);
  });

  it('全角や大文字の揺れは一致に影響しない', () => {
    const keep = rowFilter(state({ query: 'ｗｉｋｉ' }), NOW);

    expect(keep(row({ title: 'Wiki の整理' }))).toBe(true);
  });
});
