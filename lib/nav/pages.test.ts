import { describe, expect, it } from 'vitest';

import { pages, pagesFor } from './pages';

const origin = 'https://nulab.backlog.com';

describe('ページ定義', () => {
  it('プロジェクトのページはプロジェクトキーが分かるときだけ URL を組める', () => {
    const board = pages.find((p) => p.id === 'board');
    expect(board?.build({ origin, projectKey: 'PROJ' })).toBe(`${origin}/board/PROJ`);
    expect(board?.build({ origin })).toBeUndefined();
  });

  it('スペースのページはプロジェクトが無くても URL を組める', () => {
    expect(pagesFor('space', { origin }).map((p) => p.id)).toEqual(['dashboard', 'all-issues']);
  });

  it('プロジェクトキーが無い文脈ではプロジェクトのページは候補から落ちる', () => {
    expect(pagesFor('project', { origin })).toEqual([]);
    expect(pagesFor('project', { origin, projectKey: 'PROJ' }).length).toBeGreaterThan(5);
  });

  it('共通のページは URL が未確認なので定義に無い（D-20 の未確認）', () => {
    expect(pagesFor('common', { origin })).toEqual([]);
  });

  it('プロジェクト設定はレガシーの .action に project.key で飛ぶ', () => {
    const settings = pages.find((p) => p.id === 'project-settings');
    expect(settings?.build({ origin, projectKey: 'PROJ' })).toBe(
      `${origin}/EditProject.action?project.key=PROJ`,
    );
  });

  it('id は重複せず、どのページもかなか英字の別名を持つ', () => {
    expect(new Set(pages.map((p) => p.id)).size).toBe(pages.length);
    for (const page of pages) expect(page.aliases.length).toBeGreaterThan(0);
  });
});
