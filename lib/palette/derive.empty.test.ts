import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import { emptyStack, stackOf } from '@/lib/stack/stack';
import type { Stack } from '@/lib/stack/types';

import { derive, type DerivedPalette } from './derive';
import { acme, beta, index, login, nulab, payment, web } from './fixture';
import type { PaletteIndex } from './model';
import { initialState, type PaletteState } from './state';

const space = { kind: 'space', spaceId: 'nulab', label: nulab.label } as const;
const project = { kind: 'project', projectId: '1', projectKey: 'PROJ', label: web.name } as const;
const spaceStack = stackOf(space);

const run = (
  partial: Partial<PaletteState>,
  override: Partial<PaletteIndex> = {},
): DerivedPalette =>
  derive(
    { ...initialState, stack: stackOf(space, project), ...partial },
    { ...index, ...override },
    ja,
    { platform: 'mac', panelAvailable: true },
  );

const sectionIds = (d: DerivedPalette) => d.view.sections.map((s) => s.id);
const rowsOf = (d: DerivedPalette, section: string) =>
  d.view.sections.find((s) => s.id === section)?.rows ?? [];
const titles = (d: DerivedPalette, section: string) => rowsOf(d, section).map((r) => r.title);

describe('空状態（§9）: 期限', () => {
  it('担当課題のうち期限が近いものだけ、行に期限が出る（並びは変えない）', () => {
    const soon = { ...login, dueDate: new Date(index.now + 2 * 24 * 60 * 60 * 1000).toISOString() };
    const far = {
      ...payment,
      dueDate: new Date(index.now + 60 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const d = run({}, { assigned: { kind: 'ready', rows: [soon, far] } });
    const rows = rowsOf(d, 'assigned');
    expect(rows[0]?.due?.tone).toBe('warning');
    expect(rows[1]?.due).toBeUndefined();
    expect(rows.map((r) => r.code)).toEqual([soon.key, far.key]);
  });
});

describe('空状態（§9）: 取得失敗', () => {
  it('担当課題が取れなかったら、読み込み中のままにせず理由を行にする', () => {
    const unauthorized = run({}, { assigned: { kind: 'failed', error: { kind: 'unauthorized' } } });
    const row = rowsOf(unauthorized, 'assigned')[0];
    expect(row?.kind).toBe('status');
    expect(row?.title).toBe(ja.rows.authExpired(nulab.label));
    expect(row?.hints).toContain('enter');

    const offline = run({}, { assigned: { kind: 'failed', error: { kind: 'offline' } } });
    expect(rowsOf(offline, 'assigned')[0]?.title).toBe(ja.rows.offline);
    expect(rowsOf(offline, 'assigned')[0]?.hints).toEqual([]);
  });

  it('案内行を出すかは履歴だけで決まり、担当課題が後から届いても消えない', () => {
    const pending = run({}, { activity: [], assigned: { kind: 'loading' } });
    const arrived = run({}, { activity: [], assigned: { kind: 'ready', rows: [login] } });
    expect(sectionIds(pending).at(-1)).toBe('hint');
    expect(sectionIds(arrived).at(-1)).toBe('hint');
  });
});

describe('空状態（§9）: 今いるページと重複', () => {
  it('今いるページは「最近開いた」にも「のページ」にも出ない', () => {
    const d = run({}, { currentUrl: payment.url });
    expect(titles(d, 'recent')).not.toContain(payment.title);
    expect(titles(d, 'recent')[0]).toBe('プッシュ通知の受信設定をオンボーディングに組み込む');

    const onBoard = run({}, { currentUrl: '/board/PROJ' });
    expect(titles(onBoard, 'pages')).not.toContain('ボード');
  });

  it('末尾スラッシュやクエリが付いていても、今いるページは除かれる', () => {
    const withSlash = run({}, { currentUrl: `${payment.url}/` });
    const withQuery = run({}, { currentUrl: `${payment.url}?comment=1` });
    // 索引が持つのは正規形なので、これらは一致しない = 除けない。
    // 正規化は buildIndex が入口で済ませる契約（D-52）で、derive は完全一致だけを見る
    expect(titles(withSlash, 'recent')).toContain(payment.title);
    expect(titles(withQuery, 'recent')).toContain(payment.title);
    expect(titles(run({}, { currentUrl: payment.url }), 'recent')).not.toContain(payment.title);
  });

  it('同じ対象が表示キャッシュに 2 件あっても「最近開いた」は 1 行にする', () => {
    const twice = [...index.cache, { ...payment, url: `${payment.url}/` }];
    const d = run({}, { cache: twice });
    expect(titles(d, 'recent').filter((t) => t === payment.title)).toHaveLength(1);
  });

  it('既定の選択は動作を持つ最初の行で、案内行や読み込み中の行には止まらない', () => {
    const d = run({}, { activity: [], assigned: { kind: 'loading' } });
    const selected = d.view.sections
      .flatMap((s) => s.rows)
      .find((row) => row.id === d.view.selectedId);
    expect(selected?.hints.length ?? 0).toBeGreaterThan(0);
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
