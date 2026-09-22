import { describe, expect, it } from 'vitest';

import { canonicalUrl, pageKindOf, parsePath, projectKeyOf } from './path';

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

describe('URL の同一性（canonicalUrl）', () => {
  const origin = 'https://nulab.backlog.com';

  it('末尾のスラッシュは同じページとして畳む', () => {
    expect(canonicalUrl(`${origin}/view/PROJ-1/`)).toBe(`${origin}/view/PROJ-1`);
    expect(canonicalUrl(`${origin}/projects/PROJ/`)).toBe(`${origin}/projects/PROJ`);
  });

  it('課題キーの大文字小文字は同じページとして畳む', () => {
    expect(canonicalUrl(`${origin}/view/proj-1`)).toBe(`${origin}/view/PROJ-1`);
  });

  it('表示状態のクエリとフラグメントは落とす', () => {
    expect(canonicalUrl(`${origin}/view/PROJ-1#comment-12`)).toBe(`${origin}/view/PROJ-1`);
    expect(canonicalUrl(`${origin}/find/PROJ?statusId=2`)).toBe(`${origin}/find/PROJ`);
  });

  it('プロジェクト設定はクエリが識別子なので残す。落とすと別プロジェクトと同じ URL になる', () => {
    const proj = canonicalUrl(`${origin}/EditProject.action?project.key=PROJ`);
    const mob = canonicalUrl(`${origin}/EditProject.action?project.key=MOB`);
    expect(proj).toBe(`${origin}/EditProject.action?project.key=PROJ`);
    expect(proj).not.toBe(mob);
  });
});

describe('URL の同一性: 区別する値は触らない', () => {
  const origin = 'https://nulab.backlog.com';

  it('Wiki の名前は大文字小文字も末尾のスラッシュもエンコードも触らない', () => {
    expect(canonicalUrl(`${origin}/wiki/PROJ/Home`)).toBe(`${origin}/wiki/PROJ/Home`);
    expect(canonicalUrl(`${origin}/wiki/PROJ/home`)).toBe(`${origin}/wiki/PROJ/home`);
    expect(canonicalUrl(`${origin}/wiki/PROJ/a/b`)).toBe(`${origin}/wiki/PROJ/a/b`);
  });

  it('別名の Wiki は id のまま畳む', () => {
    expect(canonicalUrl(`${origin}/alias/wiki/42/`)).toBe(`${origin}/alias/wiki/42`);
  });

  it('ドキュメント ID の大文字小文字は区別する', () => {
    expect(canonicalUrl(`${origin}/document/PROJ/aBc`)).toBe(`${origin}/document/PROJ/aBc`);
  });

  it('旧形式のパスは正規のパスに畳む', () => {
    expect(canonicalUrl(`${origin}/FindIssueAllOver.action`)).toBe(
      `${origin}/FindIssueAllOver.action`,
    );
  });

  it('解釈できないパスと URL でない文字列は undefined', () => {
    expect(canonicalUrl(`${origin}/unknown/thing`)).toBeUndefined();
    expect(canonicalUrl('not a url')).toBeUndefined();
  });

  it('オリジンは変えない', () => {
    expect(canonicalUrl('https://acme.backlog.jp/view/ACME-1')).toBe(
      'https://acme.backlog.jp/view/ACME-1',
    );
  });
});
