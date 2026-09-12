import { defaultSearchState, type SearchState } from '@backlog-palette/core';
import { describe, expect, it } from 'vitest';
import { applySuggestion, emptySuggestions } from './suggestions.ts';

const base: SearchState = { ...defaultSearchState, query: '請求書' };
const origin = 'https://demo.backlog.jp';

const ids = (state: SearchState, ctx = {}) => emptySuggestions(state, ctx).map((s) => s.id);
const labels = (state: SearchState, ctx = {}) =>
  emptySuggestions(state, ctx).map((s) => `${s.label} ${s.sub ?? ''}`);

describe('0 件のときの提案', () => {
  it('効いている条件を外す提案が出る', () => {
    const state: SearchState = { ...base, status: { kind: 'preset', preset: 'openOnly' } };

    expect(labels(state)).toContain(
      'ステータス「完了を除く」を外す 条件をひとつ外して探し直します',
    );
  });

  it('条件が効いていなければ条件の提案は出ない', () => {
    expect(emptySuggestions(base).filter((s) => s.group === 'condition')).toEqual([]);
  });

  it('効いている条件が 2 つ以上あればまとめて外す提案も出る', () => {
    const state: SearchState = {
      ...base,
      status: { kind: 'preset', preset: 'openOnly' },
      assignee: { kind: 'me' },
    };

    expect(emptySuggestions(state).filter((s) => s.group === 'condition')).toHaveLength(3);
  });

  it('スペースを絞っているときだけスコープを広げる提案が出る', () => {
    const scoped: SearchState = { ...base, scope: { kind: 'space', spaceKey: 'demo' } };

    expect(emptySuggestions(scoped).some((s) => s.group === 'scope')).toBe(true);
    expect(emptySuggestions(base).some((s) => s.group === 'scope')).toBe(false);
  });

  it('本体の全体検索はオリジンが分かるときだけ誘導する', () => {
    expect(emptySuggestions(base, { origin }).some((s) => s.group === 'external')).toBe(true);
    expect(emptySuggestions(base).some((s) => s.group === 'external')).toBe(false);
  });

  it('広げたときの件数は予告しない', () => {
    const state: SearchState = {
      ...base,
      scope: { kind: 'space', spaceKey: 'demo' },
      assignee: { kind: 'me' },
    };

    for (const label of labels(state, { origin })) {
      expect(label).not.toMatch(/\d+\s*件/);
    }
  });
});

describe('提案を選んだとき', () => {
  it('条件を外す提案はその条件だけを既定へ戻す', () => {
    const state: SearchState = {
      ...base,
      status: { kind: 'preset', preset: 'openOnly' },
      assignee: { kind: 'me' },
    };
    const target = ids(state).find((id) => id.includes('status')) ?? '';

    const outcome = applySuggestion(state, target);

    expect(outcome).toEqual({
      kind: 'search',
      state: { ...state, status: { kind: 'any' } },
    });
  });

  it('まとめて外す提案はスコープとクエリを残す', () => {
    const state: SearchState = {
      ...base,
      scope: { kind: 'space', spaceKey: 'demo' },
      status: { kind: 'preset', preset: 'openOnly' },
      updated: { kind: 'withinDays', days: 7 },
    };

    const outcome = applySuggestion(state, 'suggestion:clearConditions');

    expect(outcome).toEqual({
      kind: 'search',
      state: { ...defaultSearchState, query: '請求書', scope: { kind: 'space', spaceKey: 'demo' } },
    });
  });

  it('スコープを広げる提案は全スペースにする', () => {
    const state: SearchState = { ...base, scope: { kind: 'space', spaceKey: 'demo' } };
    const target = ids(state).find((id) => id.includes('scope')) ?? '';

    expect(applySuggestion(state, target)).toEqual({
      kind: 'search',
      state: { ...state, scope: { kind: 'allSpaces' } },
    });
  });

  it('本体の全体検索はキーワードを付けずに開く', () => {
    expect(applySuggestion(base, 'suggestion:external', { origin })).toEqual({
      kind: 'open',
      url: 'https://demo.backlog.jp/FindIssueAllOver.action',
    });
  });

  it('知らない提案では何も起こさない', () => {
    expect(applySuggestion(base, 'suggestion:unknown')).toBeUndefined();
  });
});
