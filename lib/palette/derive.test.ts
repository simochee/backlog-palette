import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import { emptyStack, pushCommand, stackOf } from '@/lib/stack/stack';

import { switchSpaceCommand } from './candidates';
import { derive, type DerivedPalette } from './derive';
import { index, nulab, web } from './fixture';
import type { PaletteIndex } from './model';
import { initialState, type PaletteState } from './state';

const space = { kind: 'space', spaceId: 'nulab', label: nulab.label } as const;
const project = { kind: 'project', projectId: '1', projectKey: 'PROJ', label: web.name } as const;
const projectStack = stackOf(space, project);
const spaceStack = stackOf(space);

const run = (
  partial: Partial<PaletteState>,
  override: Partial<PaletteIndex> = {},
): DerivedPalette =>
  derive({ ...initialState, stack: projectStack, ...partial }, { ...index, ...override }, ja, {
    platform: 'mac',
    panelAvailable: true,
  });

const sectionIds = (d: DerivedPalette) => d.view.sections.map((s) => s.id);
const rowsOf = (d: DerivedPalette, section: string) =>
  d.view.sections.find((s) => s.id === section)?.rows ?? [];
const titles = (d: DerivedPalette, section: string) => rowsOf(d, section).map((r) => r.title);

describe('空状態（§9）', () => {
  it('最近開いた → この課題 → プロジェクトのページ → 担当中の課題 の順に並ぶ', () => {
    expect(sectionIds(run({}))).toEqual(['recent', 'issue', 'pages', 'assigned']);
  });

  it('「この課題」は課題ページのときだけ出て、先頭には来ない（先頭は戻る先）', () => {
    expect(sectionIds(run({}, { currentIssue: undefined }))).not.toContain('issue');
    expect(sectionIds(run({}))[0]).toBe('recent');
    expect(rowsOf(run({}), 'issue')[0]?.hints).toContain('descend');
  });

  it('最近開いたは頻度 × 直近性の順で、補足に「学習で並び替え」', () => {
    const d = run({});
    expect(titles(d, 'recent')[0]).toBe('決済フローのエラーハンドリングを見直す');
    expect(d.view.sections[0]?.meta).toBe(ja.sections.learned);
  });

  it('課題ページから開いたときはボードがページの先頭に来る（遷移パターンはこのセクション内だけ）', () => {
    expect(titles(run({}), 'pages')[0]).toBe('ボード');
    expect(sectionIds(run({}))[0]).toBe('recent');
  });

  it('ページは 5 件で切れ、切れた分は補足の「他 N 件」になる', () => {
    const d = run({});
    expect(rowsOf(d, 'pages')).toHaveLength(5);
    expect(d.view.sections.find((s) => s.id === 'pages')?.meta).toBe(ja.sections.more(1));
  });
});

describe('空状態（§9）: 取得中と案内行', () => {
  it('担当課題は届く前から見出しと読み込み中の行が出て、届いたら件数つきで置き換わる', () => {
    const pending = run({}, { assigned: { kind: 'loading' } });
    expect(sectionIds(pending)).toEqual(['recent', 'issue', 'pages', 'assigned']);
    expect(rowsOf(pending, 'assigned')).toHaveLength(1);
    expect(rowsOf(pending, 'assigned')[0]?.hints).toEqual([]);

    const d = run({});
    expect(d.view.sections.at(-1)?.meta).toBe(ja.sections.count(2));
  });

  it('思い出せるものが無ければページの下に案内行が出て、案内行は動作を持たない', () => {
    const d = run({}, { activity: [], assigned: { kind: 'ready', rows: [] } });
    expect(sectionIds(d)).toEqual(['issue', 'pages', 'hint']);
    expect(rowsOf(d, 'hint')[0]?.hints).toEqual([]);
  });
});

describe('コマンド階層と削除待ち', () => {
  it('コマンド階層では引数の行だけが出て、esc は「1 つ前に戻る」', () => {
    const d = run({ stack: pushCommand(spaceStack, switchSpaceCommand) });
    expect(sectionIds(d)).toEqual(['args']);
    expect(rowsOf(d, 'args')[0]?.hints).toContain('stack');
    expect(d.view.escLabel).toBe(ja.palette.escBack);
  });

  it('削除待ちでは右端の段に印が付き、予告とフッターの文言が変わる', () => {
    const d = run({ stack: { ...projectStack, armedForDelete: true } });
    expect(d.view.path.at(-1)?.armed).toBe(true);
    expect(d.view.armedNotice).toBe(ja.palette.armedNotice(web.name));
    expect(d.view.footer.find((h) => h.id === 'back')?.label).toBe(ja.keys.back(web.name));
  });
});

describe('選択とヒント（I1・I2）', () => {
  it('選択が未指定または存在しない id なら先頭行になる', () => {
    expect(run({}).view.selectedId).toBe(run({}).view.sections[0]?.rows[0]?.id);
    expect(run({ selectedId: 'gone' }).view.selectedId).toBe(run({}).view.selectedId);
  });

  it('行の hints は動作から導かれる: ページは開く・新しいタブ・補完', () => {
    const d = run({ input: 'がんと' });
    const row = rowsOf(d, 'pages')[0];
    expect(row?.hints).toEqual(['enter', 'modEnter', 'complete']);
    expect(d.takes.get(row?.id ?? '')).toEqual({ kind: 'complete', text: 'ガントチャート' });
  });

  it('フッターは選択行に応じて出る', () => {
    const d = run({ input: 'ログイン' });
    expect(d.view.footer.map((h) => h.id)).toEqual(['enter', 'move', 'back', 'toPanel']);
    expect(d.view.footer[0]?.label).toBe(ja.keys.search);
  });

  it('全体は 12 行で切れる', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...index.spaces[0]!,
      id: `s${i}`,
      label: `スペース ${i}`,
    }));
    const d = run({ stack: emptyStack }, { spaces: many });
    expect(d.view.sections.flatMap((s) => s.rows)).toHaveLength(12);
    expect(d.view.sections[0]?.meta).toBe(ja.sections.more(8));
  });
});
