import { describe, expect, it } from 'vitest';
import { ALL_PAGES, availablePages, issueUrl, type NavContext, SPACE_PAGES } from './pages.ts';

const ORIGIN = 'https://simochee.backlog.com';
const ctx: NavContext = { origin: ORIGIN, projectKey: 'MY_NEW_PRJ', projectId: 803015 };

const urlOf = (id: string, context: NavContext = ctx) =>
  availablePages(context).find((page) => page.id === id)?.url;

describe('スペースのページ', () => {
  it('プロジェクトが分からなくても開ける', () => {
    const ids = availablePages({ origin: ORIGIN }).map((page) => page.id);
    expect(ids).toEqual(SPACE_PAGES.map((page) => page.id));
  });

  it('個人設定とスペース設定はそれぞれの入口へ飛ぶ', () => {
    expect(urlOf('personal-settings')).toBe(`${ORIGIN}/EditProfile.action`);
    expect(urlOf('space-settings')).toBe(`${ORIGIN}/EditSpace.action`);
  });

  it('メンバー一覧はページング引数付きで開く', () => {
    expect(urlOf('members')).toBe(`${ORIGIN}/ListUser.action?q.limit=20&q.offset=0`);
  });

  it('担当している課題はダッシュボードで引ける', () => {
    const dashboard = ALL_PAGES.find((page) => page.id === 'dashboard');
    expect(dashboard?.aliases).toContain('担当している課題');
  });
});

describe('プロジェクトのページ', () => {
  it('プロジェクトキーから組み立てる', () => {
    expect(urlOf('board')).toBe(`${ORIGIN}/board/MY_NEW_PRJ`);
    expect(urlOf('issues')).toBe(`${ORIGIN}/find/MY_NEW_PRJ`);
    expect(urlOf('add-issue')).toBe(`${ORIGIN}/add/MY_NEW_PRJ`);
  });

  it('プロジェクトが分からなければ候補に出さない', () => {
    expect(urlOf('board', { origin: ORIGIN })).toBeUndefined();
  });

  it('マイルストーンは数値のプロジェクト ID を使う', () => {
    expect(urlOf('milestones')).toBe(`${ORIGIN}/ListVersion.action?projectId=803015`);
  });

  it('数値の ID が無いときマイルストーンは候補に出さない', () => {
    expect(urlOf('milestones', { origin: ORIGIN, projectKey: 'MY_NEW_PRJ' })).toBeUndefined();
  });
});

describe('課題', () => {
  it('課題キーから直接開ける URL を作る', () => {
    expect(issueUrl(ORIGIN, 'PROJ-123')).toBe(`${ORIGIN}/view/PROJ-123`);
  });
});

describe('ページ定義の一貫性', () => {
  it('id は重複しない', () => {
    expect(new Set(ALL_PAGES.map((page) => page.id)).size).toBe(ALL_PAGES.length);
  });

  it('すべてのページが英字の別名を持つ（英字入力でも引ける）', () => {
    for (const page of ALL_PAGES) {
      expect(page.aliases.some((alias) => /^[a-z]/.test(alias))).toBe(true);
    }
  });
});
