import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import { stackOf } from '@/lib/stack/stack';

import { derive, type DerivedPalette } from './derive';
import { index, now, nulab, web } from './fixture';
import type { PaletteIndex } from './model';
import { initialState } from './state';

const projectStack = stackOf(
  { kind: 'space', spaceId: 'nulab', label: nulab.label },
  { kind: 'project', projectId: '1', projectKey: 'PROJ', label: web.name },
);

const run = (input: string, override: Partial<PaletteIndex> = {}): DerivedPalette =>
  derive({ ...initialState, stack: projectStack, input }, { ...index, ...override }, ja, {
    platform: 'mac',
    panelAvailable: true,
  });

const pageTitles = (d: DerivedPalette) =>
  d.view.sections.find((s) => s.id === 'pages')?.rows.map((r) => r.title) ?? [];

/** 同じセクションには表示キャッシュの課題も混ざるので、2 つのページの前後だけを見る */
const order = (titles: readonly string[], first: string, second: string) =>
  titles.indexOf(first) < titles.indexOf(second) && titles.includes(second);

describe('語 → 開いた対象の学習（M6）', () => {
  // 「ー」はボードとガントチャートの両方に部分一致し、同じ強さ・同じ文脈になる
  it('同じ強さの候補の中で、その語で開いたことのある対象が先頭に来る', () => {
    const before = pageTitles(run('ー'));
    const after = pageTitles(
      run('ー', { queryDict: [{ query: 'ー', entityId: 'page:gantt', count: 1, at: now }] }),
    );

    expect(order(before, 'ボード', 'ガントチャート')).toBe(true);
    expect(order(after, 'ガントチャート', 'ボード')).toBe(true);
  });

  it('別の語で開いた記録は、この語の並びを変えない', () => {
    const titles = pageTitles(
      run('ー', { queryDict: [{ query: 'がんと', entityId: 'page:gantt', count: 9, at: now }] }),
    );

    expect(order(titles, 'ボード', 'ガントチャート')).toBe(true);
  });

  it('前方一致する候補は、部分一致の候補に学習があっても先頭のまま', () => {
    // 「ぼ」はボードに前方一致。ガントチャートは一致しないので、学習は候補の外に効かない
    const titles = pageTitles(
      run('ぼ', { queryDict: [{ query: 'ぼ', entityId: 'page:gantt', count: 9, at: now }] }),
    );

    expect(titles[0]).toBe('ボード');
    expect(titles).not.toContain('ガントチャート');
  });
});
