import { describe, expect, it } from 'vitest';
import { compareRows, emptyResultList, mergeChunk, promoteHeld } from './merge.ts';

type Row = { id: string; spaceKey: string; updatedAt: number };

const row = (id: string, spaceKey: string, updatedAt: number): Row => ({ id, spaceKey, updatedAt });
const ids = (list: { rows: readonly Row[] }) => list.rows.map((r) => r.id);

const ctx = { currentSpaceKey: 'nulab' };

describe('結果の並び', () => {
  it('現在のスペースが先に来る', () => {
    const list = mergeChunk(
      emptyResultList<Row>(),
      [row('a', 'acme', 200), row('b', 'nulab', 100)],
      {
        selectedIndex: 0,
        ctx,
      },
    );

    expect(ids(list)).toEqual(['b', 'a']);
  });

  it('同じスペースなら更新の新しい順に並ぶ', () => {
    const list = mergeChunk(
      emptyResultList<Row>(),
      [row('old', 'nulab', 100), row('new', 'nulab', 200)],
      { selectedIndex: 0, ctx },
    );

    expect(ids(list)).toEqual(['new', 'old']);
  });

  it('同点でも並びは決定的になる', () => {
    const a = compareRows(row('a', 'nulab', 100), row('b', 'nulab', 100), ctx);
    const b = compareRows(row('b', 'nulab', 100), row('a', 'nulab', 100), ctx);

    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(0);
  });
});

describe('読んでいる途中に結果が届いたとき', () => {
  const base = mergeChunk(
    emptyResultList<Row>(),
    [row('a', 'nulab', 300), row('b', 'nulab', 200), row('c', 'nulab', 100)],
    { selectedIndex: 0, ctx },
  );

  it('選択行より上には差し込まない', () => {
    const merged = mergeChunk(base, [row('newest', 'nulab', 999)], { selectedIndex: 1, ctx });

    expect(ids(merged)).toEqual(['a', 'b', 'c']);
    expect(merged.held.map((r) => r.id)).toEqual(['newest']);
  });

  it('選択行より下に入る結果はその場で並ぶ', () => {
    const merged = mergeChunk(base, [row('oldest', 'nulab', 1)], { selectedIndex: 1, ctx });

    expect(ids(merged)).toEqual(['a', 'b', 'c', 'oldest']);
    expect(merged.held).toEqual([]);
  });

  it('既に出ている行の相対位置は動かない', () => {
    const merged = mergeChunk(base, [row('mid', 'nulab', 150)], { selectedIndex: 1, ctx });

    expect(ids(merged).slice(0, 3)).toEqual(['a', 'b', 'c']);
  });

  it('選択が先頭にあるなら、届いた結果をそのまま並べ直す', () => {
    const merged = mergeChunk(base, [row('newest', 'nulab', 999)], { selectedIndex: 0, ctx });

    expect(ids(merged)[0]).toBe('newest');
    expect(merged.held).toEqual([]);
  });
});

describe('保留した結果の合流', () => {
  it('先頭に戻ったときに合流して並び直す', () => {
    const base = mergeChunk(
      emptyResultList<Row>(),
      [row('a', 'nulab', 200), row('b', 'nulab', 100)],
      { selectedIndex: 0, ctx },
    );
    const withHeld = mergeChunk(base, [row('newest', 'nulab', 999)], { selectedIndex: 1, ctx });

    expect(ids(promoteHeld(withHeld, ctx))).toEqual(['newest', 'a', 'b']);
    expect(promoteHeld(withHeld, ctx).held).toEqual([]);
  });

  it('保留が無ければ何も変わらない', () => {
    const base = mergeChunk(emptyResultList<Row>(), [row('a', 'nulab', 100)], {
      selectedIndex: 0,
      ctx,
    });

    expect(promoteHeld(base, ctx)).toBe(base);
  });
});

describe('重複', () => {
  it('同じ行が二度届いても増えない', () => {
    const once = mergeChunk(emptyResultList<Row>(), [row('a', 'nulab', 100)], {
      selectedIndex: 0,
      ctx,
    });
    const twice = mergeChunk(once, [row('a', 'nulab', 100)], { selectedIndex: 0, ctx });

    expect(ids(twice)).toEqual(['a']);
  });

  it('保留中の行と同じものが届いても二重にならない', () => {
    const base = mergeChunk(
      emptyResultList<Row>(),
      [row('a', 'nulab', 200), row('b', 'nulab', 100)],
      { selectedIndex: 0, ctx },
    );
    const held = mergeChunk(base, [row('newest', 'nulab', 999)], { selectedIndex: 1, ctx });
    const again = mergeChunk(held, [row('newest', 'nulab', 999)], { selectedIndex: 1, ctx });

    expect(again.held.map((r) => r.id)).toEqual(['newest']);
  });

  it('選択位置が並びの外にあるときは、そのまま末尾に足す', () => {
    const base = mergeChunk(emptyResultList<Row>(), [row('a', 'nulab', 100)], {
      selectedIndex: 0,
      ctx,
    });
    const merged = mergeChunk(base, [row('newest', 'nulab', 999)], { selectedIndex: 5, ctx });

    expect(ids(merged)).toEqual(['a', 'newest']);
    expect(merged.held).toEqual([]);
  });
});
