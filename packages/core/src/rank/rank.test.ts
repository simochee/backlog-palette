import { describe, expect, it } from 'vitest';
import { type Candidate, MATCH_SCORE_TIE_BAND, rankWithinSection } from './rank.ts';

function candidate(overrides: Partial<Candidate> & { id: string }): Candidate {
  return {
    matchScore: 0.5,
    matchKind: 'partial',
    frecency: 0,
    context: 'other',
    ...overrides,
  };
}

function order(candidates: readonly Candidate[]): string[] {
  return rankWithinSection(candidates).map((c) => c.id);
}

describe('完全一致の固定', () => {
  it('課題キー完全一致は、他の候補の frecency がどれだけ高くても先頭に出る', () => {
    const exact = candidate({ id: 'PROJ-1234', matchScore: 0.4, matchKind: 'exactIssueKey' });
    const favourite = candidate({
      id: 'よく開く課題',
      matchScore: 1.0,
      frecency: 1000,
      context: 'currentProject',
    });

    expect(order([favourite, exact])).toEqual(['PROJ-1234', 'よく開く課題']);
  });

  it('コマンド名完全一致も、よく使う候補より上に出る', () => {
    const exact = candidate({ id: 'ステータスを変更', matchScore: 0.4, matchKind: 'exactCommand' });
    const favourite = candidate({ id: 'よく開く課題', matchScore: 1.0, frecency: 1000 });

    expect(order([favourite, exact])).toEqual(['ステータスを変更', 'よく開く課題']);
  });

  it('完全一致同士の並びは frecency では入れ替わらない', () => {
    const rarely = candidate({ id: 'AAA-1', matchKind: 'exactIssueKey', frecency: 0 });
    const often = candidate({
      id: 'ZZZ-9',
      matchKind: 'exactIssueKey',
      frecency: 500,
      context: 'currentProject',
    });

    expect(order([rarely, often])).toEqual(['AAA-1', 'ZZZ-9']);
    expect(order([often, rarely])).toEqual(['AAA-1', 'ZZZ-9']);
  });
});

describe('学習が効く範囲', () => {
  it('一致の質が明確に違うときは、よく使う項目でも順位が上がらない', () => {
    const wellMatched = candidate({ id: '一致がよい', matchScore: 0.9 });
    const favourite = candidate({
      id: 'よく使う',
      matchScore: 0.9 - MATCH_SCORE_TIE_BAND * 3,
      frecency: 100,
      context: 'currentProject',
    });

    expect(order([favourite, wellMatched])).toEqual(['一致がよい', 'よく使う']);
  });

  it('一致の質が同点なら、よく使う項目が上に来る', () => {
    const rarely = candidate({ id: 'あまり使わない', matchScore: 0.6, frecency: 0 });
    const often = candidate({ id: 'よく使う', matchScore: 0.6, frecency: 3 });

    expect(order([rarely, often])).toEqual(['よく使う', 'あまり使わない']);
  });

  it('一致の質の差が同点とみなす幅に収まるなら、よく使う項目が上に来る', () => {
    const slightlyBetter = candidate({
      id: '少しだけ一致がよい',
      matchScore: 0.5 + MATCH_SCORE_TIE_BAND / 2,
    });
    const often = candidate({ id: 'よく使う', matchScore: 0.5, frecency: 3 });

    expect(order([slightlyBetter, often])).toEqual(['よく使う', '少しだけ一致がよい']);
  });

  it('一致の質も学習も同じなら、現在プロジェクトの候補が上に来る', () => {
    const elsewhere = candidate({ id: '他プロジェクト', context: 'other' });
    const here = candidate({ id: '現在プロジェクト', context: 'currentProject' });

    expect(order([elsewhere, here])).toEqual(['現在プロジェクト', '他プロジェクト']);
  });

  it('現在スペースの候補は、無関係なスペースの候補より上に来る', () => {
    const elsewhere = candidate({ id: '他スペース', context: 'other' });
    const here = candidate({ id: '現在スペース', context: 'currentSpace' });

    expect(order([elsewhere, here])).toEqual(['現在スペース', '他スペース']);
  });
});

describe('並びの安定性', () => {
  const section: readonly Candidate[] = [
    candidate({ id: 'c', matchScore: 0.7, frecency: 2 }),
    candidate({ id: 'a', matchScore: 0.7, frecency: 2 }),
    candidate({ id: 'b', matchScore: 0.9, matchKind: 'exactIssueKey' }),
    candidate({ id: 'd', matchScore: 0.3, frecency: 50 }),
  ];

  it('同じ入力に対して並びは常に同じ', () => {
    expect(order(section)).toEqual(order(section));
  });

  it('渡す順序が違っても並びは同じ', () => {
    expect(order([...section].reverse())).toEqual(order(section));
  });

  it('一致の質も学習も同じなら id の昇順で並ぶ', () => {
    const same = [candidate({ id: 'ccc' }), candidate({ id: 'aaa' }), candidate({ id: 'bbb' })];
    expect(order(same)).toEqual(['aaa', 'bbb', 'ccc']);
  });

  it('渡された配列を書き換えない', () => {
    const given = [...section];
    rankWithinSection(given);
    expect(given.map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});
