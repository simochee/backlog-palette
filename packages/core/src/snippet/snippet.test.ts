import { describe, expect, it } from 'vitest';
import { snippet } from './snippet.ts';

const text = (segments: readonly { text: string }[]) => segments.map((s) => s.text).join('');
const marked = (segments: readonly { text: string; highlight?: boolean }[]) =>
  segments.filter((s) => s.highlight === true).map((s) => s.text);

describe('本文の抜粋', () => {
  it('探している語は抜粋の先頭近くに出る', () => {
    const body = `${'あ'.repeat(500)}ログイン画面のバリデーション${'い'.repeat(500)}`;

    const segments = snippet(body, 'ログイン', { length: 80, lead: 10 });

    expect(text(segments).indexOf('ログイン')).toBeLessThanOrEqual(11);
    expect(marked(segments)).toEqual(['ログイン']);
  });

  it('冒頭を飛ばしたことが省略記号で分かる', () => {
    const body = `${'あ'.repeat(100)}ログイン`;

    expect(snippet(body, 'ログイン', { length: 40 })[0]?.text).toBe('…');
  });

  it('抜粋に収まりきらない続きも省略記号で示す', () => {
    const body = `ログイン${'あ'.repeat(100)}`;

    const segments = snippet(body, 'ログイン', { length: 40 });

    expect(segments[segments.length - 1]?.text).toBe('…');
  });

  it('本文が短ければ省略記号を付けない', () => {
    const segments = snippet('ログイン画面の修正', 'ログイン');

    expect(text(segments)).toBe('ログイン画面の修正');
  });

  it('かなの揺れを吸収しても、返る文字は元の本文のまま', () => {
    const segments = snippet('ログイン画面の修正', 'ろぐいん');

    expect(marked(segments)).toEqual(['ログイン']);
  });

  it('全角で書かれた語は半角で打っても一致する', () => {
    const segments = snippet('ＡＰＩキーの発行', 'api');

    expect(marked(segments)).toEqual(['ＡＰＩ']);
  });

  it('半角カナのように畳むと長さが変わる語も、元の本文の位置でハイライトする', () => {
    const segments = snippet('ﾛｸﾞｲﾝ画面の修正', 'ログイン');

    expect(marked(segments)).toEqual(['ﾛｸﾞｲﾝ']);
    expect(text(segments)).toBe('ﾛｸﾞｲﾝ画面の修正');
  });

  it('大文字小文字の違いは無視して一致する', () => {
    expect(marked(snippet('OAuth の設定', 'oauth'))).toEqual(['OAuth']);
  });

  it('空白で区切った語はどちらもハイライトする', () => {
    const segments = snippet('決済のエラーとログインのエラー', 'ログイン 決済');

    expect(marked(segments)).toEqual(['決済', 'ログイン']);
  });

  it('同じ語が何度も出てくればすべてハイライトする', () => {
    expect(marked(snippet('ログインとログアウトとログイン', 'ログイン'))).toEqual([
      'ログイン',
      'ログイン',
    ]);
  });

  it('重なった語のハイライトは 1 つにまとまる', () => {
    expect(marked(snippet('ログイン画面', 'ログ ログイン'))).toEqual(['ログイン']);
  });

  it('一致しないときは本文の冒頭を返し、どこもハイライトしない', () => {
    const body = `${'あ'.repeat(100)}`;

    const segments = snippet(body, '請求書', { length: 20 });

    expect(marked(segments)).toEqual([]);
    expect(text(segments)).toBe(`${'あ'.repeat(20)}…`);
  });

  it('空のクエリではハイライトしない', () => {
    expect(marked(snippet('ログイン画面の修正', '   '))).toEqual([]);
  });

  it('本文が無ければ抜粋も無い', () => {
    expect(snippet('', 'ログイン')).toEqual([]);
  });

  it('抜粋は空行から始まらない', () => {
    const segments = snippet('\n\n\nログイン画面の修正', 'ログイン', { length: 40, lead: 10 });

    expect(text(segments).startsWith('ログイン')).toBe(true);
  });

  it('絵文字の途中では切らない', () => {
    const body = `ログイン${'🙂'.repeat(20)}`;

    const segments = snippet(body, 'ログイン', { length: 9, lead: 0 });

    expect(text(segments)).toBe('ログイン🙂🙂…');
  });
});
