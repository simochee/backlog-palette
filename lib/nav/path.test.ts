import { describe, expect, it } from 'vitest';

import { pageKindOf, parsePath, projectKeyOf } from './path';

describe('パスの解釈', () => {
  it('課題ページは課題キーとプロジェクトキーを大文字の正規形で読む', () => {
    expect(parsePath('/view/proj-123')).toEqual({
      kind: 'issue',
      projectKey: 'PROJ',
      issueKey: 'PROJ-123',
    });
  });

  it('プロジェクトホームはプロジェクトとして読む', () => {
    expect(parsePath('/projects/PROJ')).toEqual({ kind: 'project', projectKey: 'PROJ' });
  });

  it('Wiki の名前はパーセントデコードし、大文字小文字は変えない', () => {
    expect(parsePath('/wiki/PROJ/%E3%83%9B%E3%83%BC%E3%83%A0/Sub')).toEqual({
      kind: 'wiki',
      projectKey: 'PROJ',
      name: 'ホーム/Sub',
    });
  });

  it('ID 指定の Wiki とドキュメントも読める', () => {
    expect(parsePath('/alias/wiki/42')).toEqual({ kind: 'wikiAlias', wikiId: '42' });
    expect(parsePath('/document/PROJ/abcDEF')).toEqual({
      kind: 'document',
      projectKey: 'PROJ',
      documentId: 'abcDEF',
    });
  });

  it('ページ定義のパスはページ id とプロジェクトキーになる', () => {
    expect(parsePath('/board/PROJ')).toEqual({ kind: 'page', pageId: 'board', projectKey: 'PROJ' });
    expect(parsePath('/dashboard')).toEqual({ kind: 'page', pageId: 'dashboard' });
  });

  it('Wiki トップは Wiki の個別ページではなくページ定義になる', () => {
    expect(parsePath('/wiki/PROJ')).toEqual({ kind: 'page', pageId: 'wiki', projectKey: 'PROJ' });
  });
});

describe('種別とプロジェクトキーの取り出し', () => {
  it('知らないパスは undefined', () => {
    expect(parsePath('/globalbar/issuefilters.json')).toBeUndefined();
    expect(parsePath('/view/123')).toBeUndefined();
  });

  it('現在ページの種別は遷移パターンの from として取り出せる', () => {
    expect(pageKindOf('/view/PROJ-1')).toBe('issue');
    expect(pageKindOf('/gantt/PROJ')).toBe('gantt');
    expect(pageKindOf('/nowhere')).toBeUndefined();
  });

  it('プロジェクトキーはどの種別のパスからも取り出せる', () => {
    expect(projectKeyOf('/view/PROJ-1')).toBe('PROJ');
    expect(projectKeyOf('/find/MOB')).toBe('MOB');
    expect(projectKeyOf('/dashboard')).toBeUndefined();
  });
});
