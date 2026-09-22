import { describe, expect, it } from 'vitest';

import { readVisitedPage } from './page';

const origin = 'https://nulab.backlog.com';

describe('表示キャッシュに記録する対象（surfaces.md §3）', () => {
  it('課題は正規形の URL と大文字の課題キーで記録する', () => {
    expect(readVisitedPage(`${origin}/view/proj-1/?x=1#c`)).toEqual({
      url: `${origin}/view/PROJ-1`,
      kind: 'issue',
      spaceHost: 'nulab.backlog.com',
      projectKey: 'PROJ',
      key: 'PROJ-1',
    });
  });

  it('名前で開いた Wiki は名前を、別名で開いた Wiki は id を key にする', () => {
    expect(readVisitedPage(`${origin}/wiki/PROJ/Home%20Page`)).toMatchObject({
      kind: 'wiki',
      projectKey: 'PROJ',
      key: 'Home Page',
    });
    expect(readVisitedPage(`${origin}/alias/wiki/42`)).toEqual({
      url: `${origin}/alias/wiki/42`,
      kind: 'wiki',
      spaceHost: 'nulab.backlog.com',
      key: '42',
    });
  });

  it('別名で開いた Wiki はプロジェクトキーを持たない。URL に入っていない', () => {
    expect(readVisitedPage(`${origin}/alias/wiki/42`)?.projectKey).toBeUndefined();
  });

  it('ドキュメント ID は大文字小文字を区別して記録する', () => {
    expect(readVisitedPage(`${origin}/document/PROJ/aBc`)?.key).toBe('aBc');
  });

  it('ページ定義（ボードなど）は記録しない。「{プロジェクト} のページ」が担当する', () => {
    expect(readVisitedPage(`${origin}/board/PROJ`)).toBeUndefined();
    expect(readVisitedPage(`${origin}/dashboard`)).toBeUndefined();
  });

  it('スペースでないホストは記録しない', () => {
    expect(readVisitedPage('https://example.com/view/PROJ-1')).toBeUndefined();
  });
});
