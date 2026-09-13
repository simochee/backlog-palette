import { describe, expect, it } from 'vitest';

import { fold, normalize } from './normalize';

describe('照合の正規形', () => {
  it('全角の英数字は半角に畳まれる', () => {
    expect(fold('ＰＲＯＪ－１２３')).toBe('proj-123');
  });

  it('全角の記号 ＞ ＃ は半角と同じ文字になる', () => {
    expect(fold('＞')).toBe('>');
    expect(fold('＃')).toBe('#');
  });

  it('カタカナはひらがなとして照合される', () => {
    expect(fold('ボード')).toBe('ぼーど');
  });

  it('半角カナは全角のひらがなに畳まれる', () => {
    expect(fold('ﾎﾞｰﾄﾞ')).toBe('ぼーど');
  });

  it('大文字と小文字は区別しない', () => {
    expect(fold('Wiki')).toBe(fold('WIKI'));
  });

  it('漢字と記号は変わらない', () => {
    expect(fold('課題一覧 · 追加')).toBe('課題一覧 · 追加');
  });
});

describe('ローマ字のかな読み替え', () => {
  it('ローマ字入力はかなの別名に届く', () => {
    expect(normalize('kadai').kana).toBe('かだい');
  });

  it('大文字で打ったローマ字も同じかなになる', () => {
    expect(normalize('KADAI').kana).toBe('かだい');
  });

  it('ヘボン式と訓令式は同じかなになる', () => {
    expect(normalize('shiryou').kana).toBe(normalize('siryou').kana);
    expect(normalize('tsuika').kana).toBe(normalize('tuika').kana);
  });

  it('n は次が子音なら ん になり、nn と末尾の n も ん になる', () => {
    expect(normalize('ganto').kana).toBe('がんと');
    expect(normalize('gannto').kana).toBe('がんと');
    expect(normalize('kaizen').kana).toBe('かいぜん');
  });

  it('n の次が母音や y のときは な行・にゃ行として読む', () => {
    expect(normalize('nani').kana).toBe('なに');
    expect(normalize('nyuuryoku').kana).toBe('にゅうりょく');
  });

  it('子音の連続は促音になる', () => {
    expect(normalize('kitte').kana).toBe('きって');
  });

  it('拗音と外来語のつづりも読める', () => {
    expect(normalize('shashin').kana).toBe('しゃしん');
    expect(normalize('fairu').kana).toBe('ふぁいる');
    expect(normalize('wiki').kana).toBe('うぃき');
  });

});

describe('かな読み替えの境界', () => {
  it('ローマ字の途中のハイフンは長音になる', () => {
    expect(normalize('bo-do').kana).toBe('ぼーど');
  });

  it('読み替えられない文字はそのまま残り、語全体は捨てない', () => {
    expect(normalize('kadai1').kana).toBe('かだい1');
  });

  it('ローマ字を含まない入力は読み替えを持たない', () => {
    expect(normalize('ログイン').kana).toBeUndefined();
    expect(normalize('123').kana).toBeUndefined();
  });

  it('カタカナで打った語とローマ字で打った語は同じ正規形に届く', () => {
    expect(fold('カダイ')).toBe(normalize('kadai').kana);
  });

  it('前後の空白は落とす', () => {
    expect(normalize('  ぼーど ').folded).toBe('ぼーど');
  });
});
