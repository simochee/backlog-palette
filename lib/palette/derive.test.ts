import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import { emptyStack, pushCommand, stackOf } from '@/lib/stack/stack';
import type { Stack } from '@/lib/stack/types';

import { switchSpaceCommand } from './candidates';
import { derive, type DerivedPalette } from './derive';
import { acme, beta, index, nulab, web } from './fixture';
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
  it('最近開いた → プロジェクトのページ → 担当中の課題 の順に並ぶ', () => {
    expect(sectionIds(run({}))).toEqual(['recent', 'pages', 'assigned']);
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
    expect(d.view.sections[1]?.meta).toBe(ja.sections.more(1));
  });

  it('担当課題が届く前はセクションが無く、届いたら件数つきで末尾に出る', () => {
    expect(sectionIds(run({}, { assigned: undefined }))).toEqual(['recent', 'pages']);
    const d = run({});
    expect(d.view.sections.at(-1)?.meta).toBe(ja.sections.count(2));
  });

  it('履歴も担当課題も無ければ案内行とページだけになり、案内行は動作を持たない', () => {
    const d = run({}, { activity: [], assigned: [] });
    expect(sectionIds(d)).toEqual(['hint', 'pages']);
    expect(rowsOf(d, 'hint')[0]?.hints).toEqual([]);
  });
});

describe('未接続と根（§9・D-20）', () => {
  it('未接続のスペースでも最近開いたは表示キャッシュから出て、その下に接続行が 1 つ出る', () => {
    const stack: Stack = stackOf({ kind: 'space', spaceId: 'nulab', label: nulab.label });
    const d = run({ stack }, { spaces: [{ ...nulab, connected: false }, acme, beta] });
    expect(sectionIds(d)).toEqual(['recent', 'pages', 'connect']);
  });

  it('最近開いたはスコープのスペースの中だけで、別スペースで開いたものは出ない（D-27）', () => {
    const d = run({});
    expect(titles(d, 'recent')).not.toContain('社内ヘルプデスク');
    expect(titles(d, 'recent')).toContain('決済フローのエラーハンドリングを見直す');
  });

  it('未接続のスペースで出せるものがページだけならページの下に接続行が 1 つ出る', () => {
    const stack: Stack = stackOf({ kind: 'space', spaceId: 'beta', label: beta.label });
    const d = run({ stack });
    expect(sectionIds(d)).toEqual(['pages', 'connect']);
    expect(d.actions.get(rowsOf(d, 'connect')[0]?.id ?? '')).toEqual({
      type: 'connect',
      spaceId: undefined,
    });
  });

  it('根では検索行を出さず、スペース（未接続は接続行）と共通のページだけ', () => {
    const d = run({ stack: emptyStack });
    expect(sectionIds(d)).toEqual(['spaces', 'common']);
    expect(rowsOf(d, 'spaces').map((r) => r.kind)).toEqual(['space', 'space', 'connect']);
    expect(d.view.input.placeholder).toBe(ja.palette.rootPlaceholder);
  });
});

describe('自由語（§4）', () => {
  it('前方一致するページがあれば候補が先で検索行は下、ゴースト補完に続きが出る', () => {
    const d = run({ input: 'がんと' });
    expect(sectionIds(d)).toEqual(['pages', 'search']);
    expect(titles(d, 'pages')[0]).toBe('ガントチャート');
    expect(d.view.input.completion).toBe('チャート');
  });

  it('ローマ字入力はかなの別名を持つページに届く', () => {
    expect(titles(run({ input: 'kadai' }), 'pages')[0]).toBe('課題一覧');
  });

  it('表示キャッシュの課題は前方一致でも強い一致に数えず、検索行が先頭に残る（D-26）', () => {
    const d = run({ input: 'ログイン' });
    expect(sectionIds(d)).toEqual(['search', 'pages']);
    expect(titles(d, 'pages')).toContain('ログイン画面のバリデーションが日本語入力で崩れる');
    expect(d.view.selectedId).toBe(d.view.sections[0]?.rows[0]?.id);
  });

  it('検索行の ↵ は現在のスコープで検索を起動する', () => {
    const d = run({ input: 'ログイン' });
    expect(d.actions.get('search:search:query')).toEqual({
      type: 'search',
      query: 'ログイン',
      scope: { kind: 'project', spaceId: 'nulab', projectId: '1' },
    });
  });

  it('何にも一致しなければ検索行だけが残る', () => {
    expect(sectionIds(run({ input: 'zzzz' }))).toEqual(['search']);
  });

  it('根で語を打っても検索行は出ず、スペース名の照合だけ', () => {
    const d = run({ stack: emptyStack, input: 'acme' });
    expect(sectionIds(d)).toEqual(['spaces']);
    expect(titles(d, 'spaces')).toEqual([acme.label]);
  });
});

describe('課題キーと課題番号（§4）', () => {
  it('課題キーは 直接開く → 前方一致する課題 → 検索行 の順', () => {
    const d = run({ input: 'PROJ-12' });
    expect(sectionIds(d)).toEqual(['direct', 'issues', 'search']);
    expect(rowsOf(d, 'issues').map((r) => r.code)).toEqual(['PROJ-120']);
    expect(d.actions.get('direct:issue:PROJ-12')).toEqual({
      type: 'navigate',
      url: 'https://nulab.backlog.com/view/PROJ-12',
    });
  });

  it('数字だけは現在プロジェクトの課題番号として同じ形になる', () => {
    const d = run({ input: '12' });
    expect(rowsOf(d, 'direct')[0]?.code).toBe('PROJ-12');
  });

  it('根では課題キーを打っても直接開く行は出ない', () => {
    expect(sectionIds(run({ stack: emptyStack, input: 'PROJ-12' }))).toEqual([]);
  });
});

describe('プレフィックス（§4）', () => {
  it('> はコマンドだけを出し、課題ページならコピー 4 種が並ぶ', () => {
    const d = run({ input: '>' });
    expect(sectionIds(d)).toEqual(['commands']);
    expect(rowsOf(d, 'commands')).toHaveLength(4);
  });

  it('スペースを切り替えはスコープが [space] のときだけ出る', () => {
    expect(titles(run({ input: '>', stack: spaceStack }), 'commands')).toContain(
      ja.rows.switchSpace,
    );
    expect(titles(run({ input: '>' }), 'commands')).not.toContain(ja.rows.switchSpace);
  });

  it('# はプロジェクトだけを出し、行は ⇥ でスコープに積める', () => {
    const d = run({ input: '#もば', stack: spaceStack });
    expect(sectionIds(d)).toEqual(['projects']);
    const row = rowsOf(d, 'projects')[0];
    expect(row?.title).toBe('モバイルアプリ v3');
    expect(row?.hints).toEqual(['enter', 'modEnter', 'stack']);
    expect(d.takes.get(row?.id ?? '')?.kind).toBe('project');
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
    expect(d.view.armedNotice).toBe(ja.palette.armedNotice);
    expect(d.view.footer.find((h) => h.id === 'back')?.label).toBe(ja.keys.backArmed(web.name));
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
