import { describe, expect, it } from 'vitest';
import { normalize } from '../query/normalize.ts';
import { match } from './match.ts';

function scoreOf(query: string, text: string): number {
  return match(query, { text }).score;
}

function highlightedIn(query: string, text: string): readonly string[] {
  return match(query, { text }).ranges.map(([start, end]) => text.slice(start, end));
}

describe('表記の揺れを越えた一致', () => {
  it('カタカナのボードはかな入力で引ける', () => {
    expect(scoreOf('ぼーど', 'ボード')).toBe(scoreOf('ボード', 'ボード'));
  });

  it('半角カナで入力しても同じ結果になる', () => {
    expect(match('ﾎﾞｰﾄﾞ', { text: 'ボード' })).toEqual(match('ボード', { text: 'ボード' }));
  });

  it('半角カナで書かれた名前も同じ強さで引ける', () => {
    expect(scoreOf('ぼーど', 'ﾎﾞｰﾄﾞ')).toBe(scoreOf('ぼーど', 'ボード'));
  });

  it('全角英数の入力は半角と同じに扱われる', () => {
    expect(scoreOf('ＰＲＯＪ', 'PROJ-123')).toBe(scoreOf('proj', 'PROJ-123'));
  });

  it('大文字小文字は区別しない', () => {
    expect(scoreOf('board', 'Board')).toBe(scoreOf('BOARD', 'board'));
  });
});

describe('一致の強さの順序', () => {
  it('完全一致は前方一致より強い', () => {
    expect(scoreOf('ぼーど', 'ボード')).toBeGreaterThan(scoreOf('ぼーど', 'ボード設定'));
  });

  it('ガントチャートは「がんと」で前方一致する', () => {
    expect(scoreOf('がんと', 'ガントチャート')).toBeGreaterThan(0);
  });

  it('前方一致は語中の連続一致より強い', () => {
    expect(scoreOf('がんと', 'ガントチャート')).toBeGreaterThan(
      scoreOf('がんと', '課題のガントチャート'),
    );
  });

  it('連続一致は部分列一致より強い', () => {
    expect(scoreOf('ちゃーと', 'ガントチャート')).toBeGreaterThan(
      scoreOf('がちゃ', 'ガントチャート'),
    );
  });

  it('ガントチャートは「がちゃ」でも引けるが「がんと」より弱い', () => {
    expect(scoreOf('がちゃ', 'ガントチャート')).toBeGreaterThan(0);
    expect(scoreOf('がちゃ', 'ガントチャート')).toBeLessThan(scoreOf('がんと', 'ガントチャート'));
  });

  it('語の先頭から始まる語中一致は、語の途中から始まる一致より強い', () => {
    expect(scoreOf('がんと', 'ボード ガントチャート')).toBeGreaterThan(
      scoreOf('がんと', 'ぼーどがんとちゃーと'),
    );
  });

  it('同じ語中一致なら前にあるほうが強い', () => {
    expect(scoreOf('ちゃーと', 'ガントチャート')).toBeGreaterThan(
      scoreOf('ちゃーと', 'プロジェクトのガントチャート'),
    );
  });

  it('部分列一致は、まとまってかかるほうが散らばった一致より強い', () => {
    expect(scoreOf('がんと', 'がん・とちゃ')).toBeGreaterThan(scoreOf('がんと', 'が・ん・と'));
  });

  it('大文字で始まる語は切れ目として加点される', () => {
    expect(scoreOf('gc', 'GanttChart')).toBeGreaterThan(scoreOf('gc', 'ganttchart'));
  });

  it('どのルールにも当てはまらなければ score 0 で位置も空', () => {
    expect(match('ぼーど', { text: 'ガントチャート' })).toEqual({ score: 0, ranges: [] });
  });

  it('文字の順序が入れ替わっていれば一致しない', () => {
    expect(scoreOf('どーぼ', 'ボード')).toBe(0);
  });
});

describe('別名による一致', () => {
  const project = { text: 'Webリニューアル', aliases: ['PROJ'] } as const;

  it('日本語のプロジェクト名はプロジェクトキーで引ける', () => {
    expect(match('proj', project).score).toBeGreaterThan(0);
  });

  it('別名経由の一致は元テキスト上の位置を返さない', () => {
    expect(match('proj', project).ranges).toEqual([]);
  });

  it('別名の一致は、同じ強さの主テキスト一致よりわずかに低い', () => {
    expect(match('proj', project).score).toBeLessThan(scoreOf('proj', 'PROJ'));
  });

  it('主テキストの一致のほうが強ければ、位置つきの結果になる', () => {
    expect(match('web', { text: 'Web', aliases: ['PROJ'] })).toEqual({
      score: scoreOf('web', 'Web'),
      ranges: [[0, 3]],
    });
  });

  it('別名の一致のほうが強ければ、主テキスト上の位置は捨てられる', () => {
    const result = match('proj', { text: 'PROJ の課題', aliases: ['PROJ'] });
    expect(result.score).toBeGreaterThan(scoreOf('proj', 'PROJ の課題'));
    expect(result.ranges).toEqual([]);
  });

  it('主テキストにも別名にも一致しなければ score 0', () => {
    expect(match('がんと', project)).toEqual({ score: 0, ranges: [] });
  });
});

describe('ハイライト位置', () => {
  it('カタカナ表記の名前でもかな入力の位置を返す', () => {
    expect(highlightedIn('がんと', 'ガントチャート')).toEqual(['ガント']);
  });

  it('位置は正規化前の元の文字列を指す', () => {
    expect(highlightedIn('ぼーど', 'ﾎﾞｰﾄﾞ設定')).toEqual(['ﾎﾞｰﾄﾞ']);
    expect(match('ぼーど', { text: 'ﾎﾞｰﾄﾞ設定' }).ranges).toEqual([[0, 5]]);
  });

  it('語中の一致はその語の位置を指す', () => {
    expect(highlightedIn('がんと', '課題のガントチャート')).toEqual(['ガント']);
  });

  it('部分列一致は連続した塊ごとに位置を返す', () => {
    expect(highlightedIn('がちゃ', 'ガントチャート')).toEqual(['ガ', 'チャ']);
  });

  it('後ろにまとまった一致があれば、そちらの位置を返す', () => {
    expect(highlightedIn('abc', 'a b abxc')).toEqual(['ab', 'c']);
  });

  it.each([
    'ﾎﾞｰﾄﾞ',
    'ＰＲＯＪ－１２３',
    'ボード',
    '決済フロー',
    '株式会社ヌーラボ',
    'Webリニューアル / 課題一覧',
    'Cafe\u0301',
    'Café',
    '한국어',
    '\u1112\u1161\u11ab',
    '様々な設定',
  ])('「%s」は自身の正規形で完全一致し、位置は文字列全体を指す', (text) => {
    expect(match(normalize(text), { text })).toEqual({
      score: scoreOf('ぼーど', 'ボード'),
      ranges: [[0, text.length]],
    });
  });
});

describe('空のクエリ', () => {
  it('空クエリは何にも一致しない', () => {
    expect(match('', { text: 'ボード' })).toEqual({ score: 0, ranges: [] });
  });

  it('空白だけのクエリも一致しない', () => {
    expect(scoreOf('　', 'ボード 設定')).toBe(0);
  });

  it('空の名前は何でも一致しない', () => {
    expect(scoreOf('ぼーど', '')).toBe(0);
  });
});
