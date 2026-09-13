import { describe, expect, it } from 'vitest';

import type { DisplayCacheEntry } from '@/lib/storage/items';

import { applyRevalidated, staleIssues } from './revalidate';

const DEMO = 'demo.backlog.jp';
const issue = (key: string, title: string | undefined, visitedAt: number): DisplayCacheEntry => ({
  url: `https://${DEMO}/view/${key}`,
  kind: 'issue',
  spaceHost: DEMO,
  projectKey: key.split('-')[0] ?? key,
  key,
  ...(title === undefined ? {} : { title }),
  visitedAt,
});
const wiki: DisplayCacheEntry = {
  url: `https://${DEMO}/wiki/PROJ/Home`,
  kind: 'wiki',
  spaceHost: DEMO,
  projectKey: 'PROJ',
  key: 'Home',
  title: 'Home',
  visitedAt: 5,
};

describe('再取得する課題の選び方', () => {
  it('表示した行の課題だけを、表示キャッシュの並びのまま選ぶ', () => {
    const entries = [
      issue('PROJ-3', 'c', 3),
      wiki,
      issue('PROJ-2', 'b', 2),
      issue('PROJ-1', 'a', 1),
    ];
    const shown = new Set([entries[3]!.url, entries[0]!.url]);

    expect(staleIssues(entries, shown)).toEqual([
      { spaceHost: DEMO, issueKey: 'PROJ-3' },
      { spaceHost: DEMO, issueKey: 'PROJ-1' },
    ]);
  });

  it('1 回に投げる数は上限で切る', () => {
    const entries = Array.from({ length: 30 }, (_, i) => issue(`PROJ-${i}`, 't', i));
    const shown = new Set(entries.map((e) => e.url));

    expect(staleIssues(entries, shown, 20)).toHaveLength(20);
  });

  it('Wiki・ドキュメント・キーの無い行は対象にしない', () => {
    const entries = [wiki, { ...issue('PROJ-9', 'x', 9), key: undefined }];

    expect(staleIssues(entries, new Set(entries.map((e) => e.url)))).toEqual([]);
  });
});

describe('再取得の結果の写し方', () => {
  const entries = [issue('PROJ-2', '古い件名', 2), wiki, issue('PROJ-1', undefined, 1)];

  it('件名が変わった行だけ更新し、visitedAt と並びは動かさない', () => {
    const { entries: next, changed } = applyRevalidated(entries, [
      { spaceHost: DEMO, issueKey: 'PROJ-2', summary: '新しい件名' },
      { spaceHost: DEMO, issueKey: 'PROJ-1', summary: '初めて分かった件名' },
    ]);

    expect(changed).toBe(2);
    expect(next.map((e) => e.url)).toEqual(entries.map((e) => e.url));
    expect(next.map((e) => e.visitedAt)).toEqual([2, 5, 1]);
    expect(next[0]?.title).toBe('新しい件名');
    expect(next[2]?.title).toBe('初めて分かった件名');
  });

  it('件名が同じなら何も変えない', () => {
    const { changed } = applyRevalidated(entries, [
      { spaceHost: DEMO, issueKey: 'PROJ-2', summary: '古い件名' },
    ]);

    expect(changed).toBe(0);
  });

  it('消えた課題（summary 無し）は残し、件名も触らない', () => {
    const { entries: next, changed } = applyRevalidated(entries, [
      { spaceHost: DEMO, issueKey: 'PROJ-2' },
    ]);

    expect(changed).toBe(0);
    expect(next).toHaveLength(3);
    expect(next[0]?.title).toBe('古い件名');
  });

  it('別スペースの同じキーには写さない', () => {
    const { changed } = applyRevalidated(entries, [
      { spaceHost: 'other.backlog.com', issueKey: 'PROJ-2', summary: '別物' },
    ]);

    expect(changed).toBe(0);
  });
});
