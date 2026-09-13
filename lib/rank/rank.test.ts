import { describe, expect, it } from 'vitest';

import type { MatchResult } from '@/lib/match/match';

import { type Ranked, rankWithinSection } from './rank';

const exact: MatchResult = { strength: 'exact', via: 'text' };
const prefix: MatchResult = { strength: 'prefix', via: 'text' };
const substring: MatchResult = { strength: 'substring', via: 'text' };

type Entry = Partial<Ranked<string>> & { id: string };
const entry = ({ id, ...rest }: Entry): Ranked<string> => ({
  id,
  item: id,
  match: prefix,
  pinned: false,
  context: 'other',
  personalScore: 0,
  ...rest,
});

const order = (entries: Ranked<string>[]) => rankWithinSection(entries).map((e) => e.id);

describe('セクション内の並び', () => {
  it('一致が強い候補が先に出る', () => {
    expect(
      order([
        entry({ id: 'sub', match: substring }),
        entry({ id: 'exact', match: exact }),
        entry({ id: 'prefix', match: prefix }),
      ]),
    ).toEqual(['exact', 'prefix', 'sub']);
  });

  it('課題キー完全一致は他候補の学習スコアがどれだけ高くても先頭に出る', () => {
    expect(
      order([
        entry({ id: 'learned', match: exact, personalScore: 1000, context: 'currentProject' }),
        entry({ id: 'PROJ-1', match: exact, pinned: true }),
      ]),
    ).toEqual(['PROJ-1', 'learned']);
  });

  it('個人スコアは一致の強さが同じ候補の間だけで効く', () => {
    expect(
      order([
        entry({ id: 'popular', match: substring, personalScore: 1000 }),
        entry({ id: 'fresh', match: prefix, personalScore: 0 }),
      ]),
    ).toEqual(['fresh', 'popular']);
  });
});

describe('同点の中の個人化', () => {
  it('同じ強さなら現在プロジェクト、次に現在スペースの候補が先', () => {
    expect(
      order([
        entry({ id: 'other', context: 'other', personalScore: 10 }),
        entry({ id: 'space', context: 'currentSpace', personalScore: 10 }),
        entry({ id: 'project', context: 'currentProject' }),
      ]),
    ).toEqual(['project', 'space', 'other']);
  });

  it('同じ強さ・同じ文脈なら個人スコアが高い候補が先', () => {
    expect(
      order([entry({ id: 'rare', personalScore: 1 }), entry({ id: 'often', personalScore: 3 })]),
    ).toEqual(['often', 'rare']);
  });

  it('同じ強さならタイトル経由の一致が別名経由より先', () => {
    expect(
      order([
        entry({ id: 'alias', match: { strength: 'prefix', via: 'alias' }, personalScore: 5 }),
        entry({ id: 'text', match: prefix }),
      ]),
    ).toEqual(['text', 'alias']);
  });

  it('すべて同じなら id 順で安定する', () => {
    expect(order([entry({ id: 'b' }), entry({ id: 'a' })])).toEqual(['a', 'b']);
    expect(order([entry({ id: 'a' }), entry({ id: 'b' })])).toEqual(['a', 'b']);
  });

  it('元の配列は並び替えない', () => {
    const entries = [entry({ id: 'b' }), entry({ id: 'a' })];
    rankWithinSection(entries);
    expect(entries.map((e) => e.id)).toEqual(['b', 'a']);
  });
});
