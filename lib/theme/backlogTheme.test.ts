import { describe, expect, it } from 'vitest';

import { parseBacklogTheme, readBacklogTheme } from './backlogTheme';

/** ReactApp.css 1.84.0 の theme-orange（ライト）を computed style で読んだ形 */
const ORANGE = {
  '--defaultColorMain': '#ea733b',
  '--defaultColorAccent': '#de5514',
  '--defaultColorAccent-rgb': '222,85,20',
  '--defaultColorBase': '#f3e6e2',
  '--defaultColorBase-rgb': '243,230,226',
  '--defaultColorBase-2': '#f7ebe9',
  '--defaultColorLink': '#c14524',
  '--defaultColorSub-1': '#ECA08B',
  '--backgroundColorSchemeBase': '#ffffff',
};

const readFrom = (variables: Record<string, string>) => (name: string) => variables[name] ?? '';

describe('ページからのテーマの読み取り', () => {
  it('テーマ変数を宣言された値のまま、どちらの配色の値かと一緒に読む', () => {
    expect(readBacklogTheme(readFrom(ORANGE), 'light')).toEqual({
      scheme: 'light',
      variables: ORANGE,
    });
  });

  it('computed style が返す前後の空白は落とす', () => {
    const padded = Object.fromEntries(
      Object.entries(ORANGE).map(([name, value]) => [name, ` ${value}`]),
    );
    expect(readBacklogTheme(readFrom(padded), 'light')?.variables).toEqual(ORANGE);
  });

  it('「r, g, b」は空白を挟んでいても受け取る', () => {
    const spaced = { ...ORANGE, '--defaultColorAccent-rgb': '222, 85, 20' };
    expect(readBacklogTheme(readFrom(spaced), 'light')?.variables).toEqual(spaced);
  });

  it('テーマ変数の無いページではテーマを持たない', () => {
    expect(readBacklogTheme(readFrom({}), 'light')).toBeUndefined();
  });

  it('1 つでも欠けていればテーマ全体を捨てる', () => {
    const { '--defaultColorLink': _, ...withoutLink } = ORANGE;
    expect(readBacklogTheme(readFrom(withoutLink), 'light')).toBeUndefined();
  });
});

describe('iframe が受けたテーマの検証', () => {
  it('Backlog が宣言する形の値はそのまま受け取る', () => {
    const theme = { scheme: 'dark', variables: ORANGE };
    expect(parseBacklogTheme(theme)).toEqual(theme);
  });

  it('hex と「r, g, b」以外の値が混じっていればテーマ全体を捨てる', () => {
    const withMain = (value: string) => ({
      scheme: 'light',
      variables: { ...ORANGE, '--defaultColorMain': value },
    });
    expect(parseBacklogTheme(withMain('red'))).toBeUndefined();
    expect(parseBacklogTheme(withMain('#ea733b; background: url(x)'))).toBeUndefined();
    expect(parseBacklogTheme(withMain('var(--x)'))).toBeUndefined();
  });

  it('配色が light / dark のどちらでもなければテーマを持たない', () => {
    expect(parseBacklogTheme({ scheme: 'sepia', variables: ORANGE })).toBeUndefined();
    expect(parseBacklogTheme({ variables: ORANGE })).toBeUndefined();
  });

  it('オブジェクトでなければテーマを持たない', () => {
    expect(parseBacklogTheme(undefined)).toBeUndefined();
    expect(parseBacklogTheme('#ea733b')).toBeUndefined();
  });
});
