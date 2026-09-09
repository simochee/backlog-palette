import { describe, expect, it } from 'vitest';
import { normalize } from './normalize.ts';

describe('一致判定のための正規化', () => {
  it('全角記号は半角と同じ形に畳まれる', () => {
    expect(normalize('＞')).toBe('>');
    expect(normalize('／')).toBe('/');
    expect(normalize('＠')).toBe('@');
    expect(normalize('＃')).toBe('#');
  });

  it('全角英数は半角になる', () => {
    expect(normalize('ＰＲＯＪ－１２３')).toBe('proj-123');
  });

  it('カタカナはひらがなに畳まれる', () => {
    expect(normalize('ボード')).toBe('ぼーど');
    expect(normalize('ガントチャート')).toBe('がんとちゃーと');
  });

  it('半角カナも同じ結果になる', () => {
    expect(normalize('ﾎﾞｰﾄﾞ')).toBe(normalize('ボード'));
  });

  it('大文字小文字を区別しない', () => {
    expect(normalize('Board')).toBe(normalize('BOARD'));
  });

  it('ひらがなの入力はそのまま通る', () => {
    expect(normalize('ぼーど')).toBe('ぼーど');
  });

  it('漢字と混在した文字列でも他の文字を壊さない', () => {
    expect(normalize('決済フロー')).toBe('決済ふろー');
  });
});
