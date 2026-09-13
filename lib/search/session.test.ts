import { describe, expect, it } from 'vitest';

import {
  arrive,
  fail,
  isDone,
  isEmpty,
  mergeHeld,
  RESULT_CAP,
  startSession,
  totalCount,
} from './session';
import type { ResultRow, SearchSession } from './types';

const scope = { kind: 'space', spaceId: 'nulab' } as const;
const row = (id: string, updatedAt: number, titleMatched = true): ResultRow => ({
  kind: 'issue',
  id,
  key: id,
  title: id,
  projectName: 'Web',
  url: `/view/${id}`,
  updatedAt,
  titleMatched,
});
const ids = (session: SearchSession) => session.rows.map((r) => r.id);

describe('起動と到着', () => {
  it('起動直後は全種別が読み込み中で、行は無い', () => {
    const session = startSession('ログイン', scope);
    expect(isDone(session)).toBe(false);
    expect(session.rows).toEqual([]);
  });

  it('選択が結果より上（検索行・プレースホルダ・notice）にあるなら届いた行はそのまま並び、件名一致 → 更新日時の新しい順', () => {
    const session = arrive(
      startSession('q', scope),
      'issue',
      [row('a', 1), row('b', 3, false), row('c', 2)],
      0,
    );
    expect(ids(session)).toEqual(['c', 'a', 'b']);
    expect(session.kinds.issue).toEqual({ state: 'ready', count: 3 });
  });

  it('先頭ヒットを選んでいるとき、後から届いた強い一致は上に入らず保留になる', () => {
    const first = arrive(startSession('q', scope), 'issue', [row('a', 5), row('b', 4)]);
    const second = arrive(first, 'wiki', [row('new', 9)], 0);
    expect(ids(second)).toEqual(['a', 'b']);
    expect(second.held.map((r) => r.id)).toEqual(['new']);
  });

  it('プレースホルダを選んでいるときの到着は並べ直してよい', () => {
    const first = arrive(startSession('q', scope), 'issue', [row('a', 5)]);
    expect(ids(arrive(first, 'wiki', [row('new', 9)]))).toEqual(['new', 'a']);
  });
});

describe('保留と合流（I4）', () => {
  it('保留中の行は選択が先頭に戻るまで合流しない', () => {
    const first = arrive(
      startSession('q', scope),
      'issue',
      [row('a', 5), row('b', 4), row('c', 3)],
      0,
    );
    const second = arrive(first, 'wiki', [row('new', 9), row('old', 1)], 1);
    expect(ids(second)).toEqual(['a', 'b', 'c', 'old']);
    expect(second.held.map((r) => r.id)).toEqual(['new']);
    const merged = mergeHeld(second);
    expect(ids(merged)).toEqual(['new', 'a', 'b', 'c', 'old']);
    expect(merged.held).toEqual([]);
  });

  it('選択行より下に入る行は下だけを並べ直し、選択行までは動かない', () => {
    const first = arrive(
      startSession('q', scope),
      'issue',
      [row('a', 5), row('b', 4), row('c', 1)],
      0,
    );
    const second = arrive(first, 'document', [row('mid', 3)], 1);
    expect(ids(second)).toEqual(['a', 'b', 'mid', 'c']);
  });
});

describe('重複と上限', () => {
  it('同じ id が二度届いても重複しない', () => {
    const first = arrive(startSession('q', scope), 'issue', [row('a', 1)]);
    expect(ids(arrive(first, 'wiki', [row('a', 1)]))).toEqual(['a']);
  });

  it('表示は 30 行で切れ、超えた分は件数として残る', () => {
    const many = Array.from({ length: 35 }, (_, i) => row(`r${i}`, i));
    const session = arrive(startSession('q', scope), 'issue', many);
    expect(session.rows).toHaveLength(RESULT_CAP);
    expect(session.overflow).toBe(5);
  });
});

describe('完了と障害', () => {
  it('全種別が揃うと完了になり、件数は種別の合計', () => {
    let session = arrive(startSession('q', scope), 'issue', [row('a', 1)]);
    session = arrive(session, 'wiki', [row('w', 1)]);
    expect(isDone(session)).toBe(false);
    session = arrive(session, 'document', []);
    expect(isDone(session)).toBe(true);
    expect(totalCount(session)).toBe(2);
  });

  it('全種別が揃って 0 件のときだけ空と判定する', () => {
    let session = arrive(startSession('q', scope), 'issue', []);
    expect(isEmpty(session)).toBe(false);
    session = arrive(arrive(session, 'wiki', []), 'document', [], 0);
    expect(isEmpty(session)).toBe(true);
  });

  it('1 種別の失敗は他の種別に影響せず、完了の判定には数える', () => {
    let session = fail(startSession('q', scope), 'wiki', { kind: 'unauthorized' });
    session = arrive(arrive(session, 'issue', [row('a', 1)]), 'document', [], 0);
    expect(isDone(session)).toBe(true);
    expect(ids(session)).toEqual(['a']);
  });
});
