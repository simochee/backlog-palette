import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import {
  EXTERNAL_ROW_ID,
  MORE_EXTERNAL_ROW_ID,
  NOTICE_ROW_ID,
  PANEL_ROW_ID,
  PLACEHOLDER_ROW_ID,
  resultRowId,
  SEARCH_ROW_ID,
  statusRowId,
  WIDEN_ROW_ID,
} from '@/lib/search/ids';
import type { ResultRow } from '@/lib/search/types';
import { stackOf } from '@/lib/stack/stack';

import { derive, type DerivedPalette } from './derive';
import { index, nulab, web } from './fixture';
import { reduce } from './reduce';
import { initialState, type PaletteAction, type PaletteState } from './state';

const space = { kind: 'space', spaceId: 'nulab', label: nulab.label } as const;
const project = { kind: 'project', projectId: '1', projectKey: 'PROJ', label: web.name } as const;
const projectScope = { kind: 'project', spaceId: 'nulab', projectId: '1' } as const;

const row = (id: string, updatedAt: number, kind: ResultRow['kind'] = 'issue'): ResultRow => ({
  kind,
  id,
  key: kind === 'issue' ? id : undefined,
  title: `${id} の件名`,
  projectName: web.name,
  url: `/view/${id}`,
  updatedAt,
  titleMatched: true,
});

const typed: PaletteState = { ...initialState, stack: stackOf(space, project), input: 'ログイン' };
const play = (state: PaletteState, actions: PaletteAction[]) =>
  actions.reduce((current, action) => reduce(current, action), state);
const started = play(typed, [{ type: 'searchStarted', query: 'ログイン', scope: projectScope }]);
const view = (state: PaletteState): DerivedPalette =>
  derive(state, index, ja, { platform: 'mac', panelAvailable: true });
const results = (d: DerivedPalette) => d.view.sections.find((s) => s.id === 'results');
const ids = (d: DerivedPalette) => d.view.sections.map((s) => s.id);

describe('起動直後（§7.2）', () => {
  it('検索結果は検索行の直下に入り、候補はその下に残る', () => {
    expect(ids(view(started))).toEqual(['search', 'results', 'pages']);
  });

  it('選択はプレースホルダ行へ移り、プレースホルダは動作を持たない', () => {
    const d = view(started);
    expect(d.view.selectedId).toBe(PLACEHOLDER_ROW_ID);
    expect(results(d)?.rows[0]?.hints).toEqual([]);
    expect(results(d)?.rows[0]?.busy).toBe(true);
  });

  it('検索行の補足は「検索中…」に、見出しの補足は種別ごとの進捗になる', () => {
    const d = view(started);
    expect(d.view.sections[0]?.rows[0]?.sub).toBe(`${nulab.label} · ${ja.rows.searching}`);
    expect(results(d)?.meta).toContain(ja.panel.loading);
  });

  it('入力が変わると検索結果は即座に消える（§7.4）', () => {
    const d = view(reduce(started, { type: 'inputChanged', value: 'ログイン画' }));
    expect(ids(d)).not.toContain('results');
  });
});

describe('到着と保留（§7.3・I4）', () => {
  const first = play(started, [
    { type: 'resultsArrived', kind: 'issue', rows: [row('PROJ-1', 3), row('PROJ-2', 2)] },
  ]);

  it('最初の結果はプレースホルダをその場で置き換え、選択は先頭ヒットへ', () => {
    expect(first.selectedId).toBe(resultRowId(row('PROJ-1', 3)));
    expect(results(view(first))?.rows.map((r) => r.code)).toEqual(['PROJ-1', 'PROJ-2']);
  });

  it('選択が下にあるとき、上に入るべき行は保留され notice 行が先頭に出る', () => {
    const moved = reduce(first, { type: 'selected', id: resultRowId(row('PROJ-2', 2)) });
    const arrived = reduce(moved, {
      type: 'resultsArrived',
      kind: 'wiki',
      rows: [row('w1', 9, 'wiki')],
    });
    const d = view(arrived);
    expect(results(d)?.rows[0]?.id).toBe(NOTICE_ROW_ID);
    expect(results(d)?.rows[0]?.title).toBe(ja.rows.pending(1));
    expect(d.view.selectedId).toBe(resultRowId(row('PROJ-2', 2)));
    expect(results(d)?.rows.map((r) => r.id)).not.toContain(resultRowId(row('w1', 9, 'wiki')));
  });

  it('notice 行の ↵ で保留が合流し、選択は先頭の結果へ', () => {
    const moved = reduce(first, { type: 'selected', id: resultRowId(row('PROJ-2', 2)) });
    const arrived = reduce(moved, {
      type: 'resultsArrived',
      kind: 'wiki',
      rows: [row('w1', 9, 'wiki')],
    });
    expect(view(arrived).actions.get(NOTICE_ROW_ID)).toEqual({ type: 'mergeHeld' });
    const merged = reduce(arrived, { type: 'heldMerged' });
    expect(merged.selectedId).toBe(resultRowId(row('w1', 9, 'wiki')));
    expect(merged.session?.held).toEqual([]);
  });
});

describe('合流と完了（§7.3）', () => {
  const first = play(started, [
    { type: 'resultsArrived', kind: 'issue', rows: [row('PROJ-1', 3), row('PROJ-2', 2)] },
  ]);

  it('↑ で選択が先頭（検索行）に戻ったときも保留は合流する', () => {
    const moved = reduce(first, { type: 'selected', id: resultRowId(row('PROJ-2', 2)) });
    const arrived = reduce(moved, {
      type: 'resultsArrived',
      kind: 'wiki',
      rows: [row('w1', 9, 'wiki')],
    });
    const back = reduce(arrived, { type: 'selected', id: SEARCH_ROW_ID });
    expect(back.session?.held).toEqual([]);
    expect(back.session?.rows[0]?.id).toBe('w1');
  });

  it('全種別が揃うと検索行と見出しの補足は件数になり、⌘⇧C が出る', () => {
    const done = play(first, [
      { type: 'resultsArrived', kind: 'wiki', rows: [] },
      { type: 'resultsArrived', kind: 'document', rows: [] },
    ]);
    const d = view(done);
    expect(d.view.sections[0]?.rows[0]?.sub).toBe(ja.sections.count(2));
    expect(results(d)?.meta).toBe(ja.sections.count(2));
    expect(d.view.footer.map((h) => h.id)).toContain('copyUrl');
  });

  it('30 件を超えた分は末尾の external 行「他 N 件」に回る', () => {
    const many = Array.from({ length: 33 }, (_, i) => row(`PROJ-${i}`, i));
    const d = view(reduce(started, { type: 'resultsArrived', kind: 'issue', rows: many }));
    const last = results(d)?.rows.at(-1);
    expect(last?.id).toBe(MORE_EXTERNAL_ROW_ID);
    expect(last?.title).toBe(ja.rows.moreExternal(3));
    expect(last?.hints).toEqual(['enter', 'modEnter']);
  });
});

describe('0 件と障害（§7.5・D-19・I6）', () => {
  const empty = play(started, [
    { type: 'resultsArrived', kind: 'issue', rows: [] },
    { type: 'resultsArrived', kind: 'wiki', rows: [] },
    { type: 'resultsArrived', kind: 'document', rows: [] },
  ]);

  it('0 件は 案内 → スコープを広げる → 詳細検索 → 本体検索 の順で、選択は最初の提案行', () => {
    const d = view(empty);
    expect(results(d)?.rows.map((r) => r.kind)).toEqual(['hint', 'search', 'panel', 'external']);
    expect(d.view.selectedId).toBe(WIDEN_ROW_ID);
    expect(d.actions.get(WIDEN_ROW_ID)).toEqual({
      type: 'search',
      query: 'ログイン',
      scope: { kind: 'space', spaceId: 'nulab' },
    });
    expect(d.actions.get(PANEL_ROW_ID)).toEqual({ type: 'openPanel' });
    expect(d.actions.get(EXTERNAL_ROW_ID)?.type).toBe('navigate');
  });

  it('スコープが [space] のときは広げる行が無く、選択は詳細検索の行', () => {
    const atSpace = play({ ...typed, stack: stackOf(space) }, [
      { type: 'searchStarted', query: 'ログイン', scope: { kind: 'space', spaceId: 'nulab' } },
      { type: 'resultsArrived', kind: 'issue', rows: [] },
      { type: 'resultsArrived', kind: 'wiki', rows: [] },
      { type: 'resultsArrived', kind: 'document', rows: [] },
    ]);
    const d = view(atSpace);
    expect(results(d)?.rows.map((r) => r.kind)).toEqual(['hint', 'panel', 'external']);
    expect(d.view.selectedId).toBe(PANEL_ROW_ID);
  });
});

describe('障害は行に閉じる（§7.5・I6）', () => {
  it('認証切れは結果の代わりに再接続の行だけを出し、候補は残る', () => {
    const failed = reduce(started, {
      type: 'searchFailed',
      kind: 'issue',
      error: { kind: 'unauthorized' },
    });
    const d = view(failed);
    expect(results(d)?.rows.map((r) => r.kind)).toEqual(['status']);
    expect(results(d)?.rows[0]?.title).toBe(ja.rows.authExpired(nulab.label));
    expect(d.view.sections[0]?.rows[0]?.sub).toBe(ja.rows.authExpired(nulab.label));
    expect(d.view.selectedId).toBe(statusRowId('nulab'));
    expect(ids(d)).toContain('pages');
    expect(d.view.footer[0]?.label).toBe(ja.keys.connect);
  });

  it('レート超過は秒数つきの行になり、↵ で再試行する', () => {
    const failed = reduce(started, {
      type: 'searchFailed',
      kind: 'issue',
      error: { kind: 'rateLimited', retryAfterSeconds: 42 },
    });
    const d = view(failed);
    expect(results(d)?.rows[0]?.title).toBe(ja.rows.rateLimited(nulab.label, 42));
    expect(d.actions.get(statusRowId('nulab'))).toEqual({ type: 'retry' });
  });

  it('オフラインでは検索行の補足が変わるだけで、選択は動かない', () => {
    const failed = reduce(started, {
      type: 'searchFailed',
      kind: 'issue',
      error: { kind: 'offline' },
    });
    const d = view(failed);
    expect(d.view.sections[0]?.rows[0]?.sub).toBe(ja.rows.offline);
    expect(d.view.selectedId).toBe(PLACEHOLDER_ROW_ID);
  });
});
