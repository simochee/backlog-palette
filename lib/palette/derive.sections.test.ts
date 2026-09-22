import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import { emptyStack, stackOf } from '@/lib/stack/stack';

import { derive, type DerivedPalette } from './derive';
import { index, nulab, now, web } from './fixture';
import type { PaletteIndex } from './model';
import { reduce } from './reduce';
import { initialState, type PaletteState } from './state';

const space = { kind: 'space', spaceId: 'nulab', label: nulab.label } as const;
const project = { kind: 'project', projectId: '1', projectKey: 'PROJ', label: web.name } as const;

const run = (
  partial: Partial<PaletteState>,
  override: Partial<PaletteIndex> = {},
): DerivedPalette =>
  derive(
    { ...initialState, stack: stackOf(space, project), ...partial },
    { ...index, ...override },
    ja,
    {
      platform: 'mac',
      panelAvailable: true,
    },
  );
const section = (d: DerivedPalette, id: string) => d.view.sections.find((s) => s.id === id);
const titles = (d: DerivedPalette, id: string) => section(d, id)?.rows.map((r) => r.title) ?? [];

describe('入力の解釈（§4）の残り', () => {
  it('> の後の語でコマンドが絞られる', () => {
    expect(titles(run({ input: '>こぴー' }), 'commands')).toHaveLength(4);
    expect(titles(run({ input: '>URL' }), 'commands')).toEqual([ja.rows.copyIssueUrl]);
  });

  it('コマンド名の完全一致は他のコマンドの学習スコアがどれだけ高くても先頭に出る', () => {
    const learned = { entityId: 'command:copy-md', at: now };
    const d = run(
      { input: `>${ja.rows.copyIssueKey}` },
      { activity: Array.from({ length: 50 }, () => learned) },
    );
    expect(titles(d, 'commands')[0]).toBe(ja.rows.copyIssueKey);
  });

  it('同じ強さなら現在プロジェクトの候補が先で、別スペースのプロジェクトは候補に出ない', () => {
    const projects = [
      { ...index.projects[2]!, name: 'Web Helpdesk' },
      { ...index.projects[1]!, name: 'Web Mobile' },
      index.projects[0]!,
    ];
    const d = run({ input: 'web' }, { projects, pagesFor: () => [], cache: [] });
    expect(titles(d, 'pages')).toEqual([web.name, 'Web Mobile']);
  });

  it('根で共通ページの名前を打つと共通のページのセクションに出る', () => {
    const d = run({ stack: emptyStack, input: '個人' });
    expect(d.view.sections.map((s) => s.id)).toEqual(['common']);
    expect(titles(d, 'common')).toEqual(['個人設定']);
  });

  it('[space] でも課題キーは直接開ける', () => {
    const d = run({ input: 'MOB-7', stack: stackOf(space) });
    expect(d.view.sections.map((s) => s.id)).toEqual(['direct', 'issues', 'search']);
    expect(titles(d, 'issues')).toEqual(['プッシュ通知の受信設定をオンボーディングに組み込む']);
  });
});

describe('空状態（§9）の残り', () => {
  it('最近開いた行の補足は見出しを繰り返さず、行が持つ情報だけを出す', () => {
    for (const row of section(run({}), 'recent')?.rows ?? [])
      expect(row.sub).not.toContain(ja.sections.recent);
  });

  it('学習がオフなら「学習で並び替え」の補足は出ない', () => {
    expect(section(run({}, { learningEnabled: false }), 'recent')?.meta).toBeUndefined();
  });

  it('[space] の空状態はスペースのページが並び、見出しはスペース名', () => {
    const d = run({ stack: stackOf(space) });
    expect(section(d, 'pages')?.label).toBe(ja.sections.pagesOf(nulab.label));
    expect(titles(d, 'pages')).toEqual(['ダッシュボード']);
  });

  it('担当中の課題は 5 件で切れ、見出しの件数は届いた全件', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...index.cache[0]!,
      id: `X-${i}`,
      key: `X-${i}`,
    }));
    const d = run({}, { assigned: many, activity: [] });
    expect(section(d, 'assigned')?.rows).toHaveLength(5);
    expect(section(d, 'assigned')?.meta).toContain(ja.sections.count(7));
    expect(section(d, 'assigned')?.meta).toContain(ja.sections.more(2));
  });
});

describe('検索の入力変更（§7.4）', () => {
  it('入力が変わった後に届いた結果は捨てられ、検索結果は出ない', () => {
    const started = reduce(
      { ...initialState, stack: stackOf(space, project), input: 'ログイン' },
      { type: 'searchStarted', query: 'ログイン', scope: { kind: 'space', spaceId: 'nulab' } },
    );
    const changed = reduce(started, { type: 'inputChanged', value: 'ログイン画' });
    const late = reduce(changed, {
      type: 'resultsArrived',
      kind: 'issue',
      rows: [
        {
          kind: 'issue',
          id: 'x',
          title: 'x',
          projectName: 'p',
          url: '/x',
          updatedAt: 1,
          titleMatched: true,
        },
      ],
    });
    expect(late.session).toBeUndefined();
    expect(run(late).view.sections.map((s) => s.id)).not.toContain('results');
  });
});
