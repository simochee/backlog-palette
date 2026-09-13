import { describe, expect, it } from 'vitest';

import { navIndex, type NavResolver } from './index-urls';

const resolver: NavResolver = {
  originOf: (spaceId) => (spaceId === 'nulab' ? 'https://nulab.backlog.com' : undefined),
  projectKeyOf: (projectId) => (projectId === '1' ? 'PROJ' : undefined),
  language: 'ja',
};
const nav = navIndex(resolver);
const space = { kind: 'space', spaceId: 'nulab' } as const;
const project = { kind: 'project', spaceId: 'nulab', projectId: '1' } as const;

describe('索引の URL とページ', () => {
  it('プロジェクトのスコープではプロジェクトのページが URL つきで並ぶ', () => {
    const pages = nav.pagesFor(project);
    expect(pages.map((p) => p.id)).toContain('board');
    expect(pages.find((p) => p.id === 'board')?.url).toBe('https://nulab.backlog.com/board/PROJ');
    expect(pages.find((p) => p.id === 'board')?.title).toBe('ボード');
  });

  it('スペースのスコープではスペースのページだけ、根では何も出ない', () => {
    expect(nav.pagesFor(space).map((p) => p.id)).toEqual(['dashboard', 'all-issues']);
    expect(nav.pagesFor({ kind: 'root' })).toEqual([]);
  });

  it('言語に応じたタイトルになる', () => {
    const en = navIndex({ ...resolver, language: 'en' });
    expect(en.pagesFor(project).find((p) => p.id === 'issues')?.title).toBe('Issues');
  });

  it('解決できないスペースやプロジェクトではページを出さない', () => {
    expect(nav.pagesFor({ kind: 'space', spaceId: 'unknown' })).toEqual([]);
    expect(nav.pagesFor({ kind: 'project', spaceId: 'nulab', projectId: '99' })).toEqual([]);
  });

  it('課題キーは /view/ の URL になる', () => {
    expect(nav.issueUrl('nulab', 'PROJ-12')).toBe('https://nulab.backlog.com/view/PROJ-12');
  });

  it('本体の検索へ逃がす先はスペースなら全体検索、プロジェクトなら課題一覧', () => {
    expect(nav.externalSearchUrl(space, 'q')).toBe(
      'https://nulab.backlog.com/FindIssueAllOver.action',
    );
    expect(nav.externalSearchUrl(project, 'q')).toBe('https://nulab.backlog.com/find/PROJ');
  });
});
