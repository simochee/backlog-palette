import { describe, expect, it } from 'vitest';
import { readVisitedPage } from './pageContext.ts';

const SPACE = 'https://nulab.backlog.jp';

describe('閲覧したページの読み取り', () => {
  it('課題ページから課題キーと件名を取り出す', () => {
    expect(
      readVisitedPage(
        `${SPACE}/view/PROJ-123`,
        'ログイン画面のバリデーション修正 | Webリニューアル',
      ),
    ).toEqual({
      spaceKey: 'nulab',
      id: 'PROJ-123',
      title: 'ログイン画面のバリデーション修正',
      projectName: 'Webリニューアル',
      kind: 'issue',
    });
  });

  it('Wiki ページはページ名まで含めて別の項目になる', () => {
    const page = readVisitedPage(`${SPACE}/wiki/PROJ/%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9`, '');
    expect(page?.kind).toBe('wiki');
    expect(page?.id).toBe('wiki/PROJ/リリース');
  });

  it('プロジェクト配下のページはプロジェクトとして記録される', () => {
    expect(readVisitedPage(`${SPACE}/board/PROJ`, 'ボード | Webリニューアル')?.id).toBe(
      'project/PROJ',
    );
  });

  it('タイトルに区切りが無ければプロジェクト名は推測しない', () => {
    const page = readVisitedPage(`${SPACE}/view/PROJ-1`, 'なにかのページ');
    expect(page?.projectName).toBeUndefined();
    expect(page?.title).toBe('なにかのページ');
  });

  it('タイトルが空でも課題キーだけで記録できる', () => {
    expect(readVisitedPage(`${SPACE}/view/PROJ-1`, '')?.title).toBe('PROJ-1');
  });

  it('スペースではないドメインは記録しない', () => {
    expect(readVisitedPage('https://backlog.com/view/PROJ-1', 'x')).toBeUndefined();
    expect(readVisitedPage('https://example.com/view/PROJ-1', 'x')).toBeUndefined();
  });

  it('対象外のページは記録しない', () => {
    expect(readVisitedPage(`${SPACE}/dashboard`, 'ダッシュボード')).toBeUndefined();
  });

  it('URL として解釈できない入力でも例外を投げない', () => {
    expect(readVisitedPage('not a url', 'x')).toBeUndefined();
  });
});
