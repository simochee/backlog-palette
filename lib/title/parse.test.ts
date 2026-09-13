import { describe, expect, it } from 'vitest';

import { displayTitle, parseTitle } from './parse';

describe('document.title の解析', () => {
  it('「件名 | プロジェクト名」の形なら件名と右側を分ける', () => {
    expect(parseTitle('ログイン画面の不具合 | Webリニューアル')).toEqual({
      summary: 'ログイン画面の不具合',
      context: 'Webリニューアル',
    });
  });

  it('件名の先頭にある課題キーは取り除く', () => {
    expect(parseTitle('PROJ-118 ログイン画面の不具合 | Webリニューアル', 'PROJ-118')?.summary).toBe(
      'ログイン画面の不具合',
    );
  });

  it('件名の中に区切りがあっても最後の区切りで分ける', () => {
    expect(parseTitle('A | B の比較 | Webリニューアル')).toEqual({
      summary: 'A | B の比較',
      context: 'Webリニューアル',
    });
  });

  it('形式が合わなければ件名を採らない', () => {
    expect(parseTitle('Backlog')).toBeUndefined();
    expect(parseTitle(' | Webリニューアル')).toBeUndefined();
    expect(parseTitle('件名 | ')).toBeUndefined();
  });

  it('形式が合わないときの表示は課題キーだけになる', () => {
    expect(displayTitle('Backlog', 'PROJ-118')).toBe('PROJ-118');
    expect(displayTitle('PROJ-118 件名 | Web', 'PROJ-118')).toBe('件名');
  });
});
