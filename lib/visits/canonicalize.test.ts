import { describe, expect, it } from 'vitest';

import type { DisplayCacheEntry } from '@/lib/storage/items';

import { canonicalizeVisits } from './canonicalize';

const origin = 'https://nulab.backlog.com';
const entry = (url: string, visitedAt: number, title?: string): DisplayCacheEntry => ({
  url,
  kind: 'issue',
  spaceHost: 'nulab.backlog.com',
  projectKey: 'PROJ',
  key: 'PROJ-1',
  ...(title === undefined ? {} : { title }),
  visitedAt,
});

describe('表示キャッシュの URL を正規形に畳む（displayCache v3）', () => {
  it('書き方が違うだけの行は 1 件になる', () => {
    const migrated = canonicalizeVisits([
      entry(`${origin}/view/proj-1`, 1),
      entry(`${origin}/view/PROJ-1/`, 2),
    ]);
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.url).toBe(`${origin}/view/PROJ-1`);
  });

  it('畳んだ行は新しく訪問した方の内容を残す', () => {
    const migrated = canonicalizeVisits([
      entry(`${origin}/view/PROJ-1`, 2, '新しい件名'),
      entry(`${origin}/view/proj-1`, 1, '古い件名'),
    ]);
    expect(migrated[0]?.title).toBe('新しい件名');
  });

  it('別の対象は畳まない', () => {
    expect(
      canonicalizeVisits([entry(`${origin}/view/PROJ-1`, 1), entry(`${origin}/view/PROJ-2`, 2)]),
    ).toHaveLength(2);
  });

  it('解釈できない URL の行は触らずに残す', () => {
    const odd = entry(`${origin}/unknown/thing`, 1);
    expect(canonicalizeVisits([odd])).toEqual([odd]);
  });

  it('並びは元の順のまま', () => {
    const migrated = canonicalizeVisits([
      entry(`${origin}/view/PROJ-2`, 3),
      entry(`${origin}/view/PROJ-1`, 2),
    ]);
    expect(migrated.map((e) => e.url)).toEqual([`${origin}/view/PROJ-2`, `${origin}/view/PROJ-1`]);
  });
});
