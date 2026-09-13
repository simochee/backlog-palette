import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import type { RowView } from '@/components/types';
import { emptyStack, pushCommand, stackOf } from '@/lib/stack/stack';

import { switchSpaceCommand } from './candidates';
import { derive, type DerivedPalette } from './derive';
import { index, login, loginWiki, nulab, web } from './fixture';
import { initialState, type PaletteState } from './state';

const space = { kind: 'space', spaceId: 'nulab', label: nulab.label } as const;
const project = { kind: 'project', projectId: '1', projectKey: 'PROJ', label: web.name } as const;

const run = (partial: Partial<PaletteState>): DerivedPalette =>
  derive({ ...initialState, stack: stackOf(space, project), ...partial }, index, ja, {
    platform: 'mac',
    panelAvailable: true,
  });
const allRows = (d: DerivedPalette): RowView[] => d.view.sections.flatMap((s) => [...s.rows]);
const rowOf = (d: DerivedPalette, kind: RowView['kind'], title?: string): RowView | undefined =>
  allRows(d).find((r) => r.kind === kind && (title === undefined || r.title === title));

describe('行のカタログ（§5）: ↵ ⌘↵ ⇥ の対応', () => {
  it('ページ・課題・Wiki は 開く / 新しいタブ / タイトル（課題はキー）で補完', () => {
    const d = run({ input: 'ログイン' });
    const issue = rowOf(d, 'issue');
    const wiki = rowOf(d, 'wiki');
    expect(issue?.hints).toEqual(['enter', 'modEnter', 'complete']);
    expect(d.takes.get(issue?.id ?? '')).toEqual({ kind: 'complete', text: login.key });
    expect(wiki?.hints).toEqual(['enter', 'modEnter', 'complete']);
    expect(d.takes.get(wiki?.id ?? '')).toEqual({ kind: 'complete', text: loginWiki.title });
  });

  it('プロジェクトとスペースは 開く / 新しいタブ / スコープに積む', () => {
    const projectRow = rowOf(run({ input: '#', stack: stackOf(space) }), 'project');
    const spaceRow = rowOf(run({ stack: emptyStack }), 'space');
    expect(projectRow?.hints).toEqual(['enter', 'modEnter', 'stack']);
    expect(spaceRow?.hints).toEqual(['enter', 'modEnter', 'stack']);
  });

  it('コピー系コマンドは ↵ で実行しトースト、⇥ でタイトルを補完。⌘↵ は無い', () => {
    const d = run({ input: '>' });
    const copy = rowOf(d, 'command', ja.rows.copyIssueKey);
    expect(copy?.hints).toEqual(['enter', 'complete']);
    expect(d.actions.get(copy?.id ?? '')).toEqual({
      type: 'copy',
      text: 'PROJ-142',
      subject: 'PROJ-142',
    });
  });

  it('2 段階コマンドは › と 積む を持ち、↵ でスタックに積む', () => {
    const d = run({ input: '>', stack: stackOf(space) });
    const row = rowOf(d, 'command', ja.rows.switchSpace);
    expect(row?.hints).toEqual(['descend', 'stack']);
    expect(d.actions.get(row?.id ?? '')?.type).toBe('descend');
    expect(d.takes.get(row?.id ?? '')).toEqual({
      kind: 'command',
      command: { ...switchSpaceCommand, label: ja.rows.switchSpace },
    });
  });
});

describe('行のカタログ（§5）: 動作を持たない行と面', () => {
  it('検索行と接続行は ↵ だけを持ち、案内行は何も持たない', () => {
    expect(rowOf(run({ input: 'zzzz' }), 'search')?.hints).toEqual(['enter']);
    expect(rowOf(run({ stack: emptyStack }), 'connect')?.hints).toEqual(['enter']);
    expect(rowOf(run({ stack: emptyStack }), 'connect')?.tone).toBe('danger');
  });

  it('直接ジャンプ行と検索行はアクセント面を敷く', () => {
    const d = run({ input: 'PROJ-1' });
    expect(rowOf(d, 'issue', ja.rows.openDirect)?.tone).toBe('accent');
    expect(rowOf(d, 'search')?.tone).toBe('accent');
  });
});

describe('行のカタログ（§5）: 表示要素', () => {
  it('課題は コード=課題キー、補足=プロジェクト · 担当者、マーカー=ステータス', () => {
    const issue = rowOf(run({ input: 'ログイン' }), 'issue');
    expect(issue?.code).toBe('PROJ-118');
    expect(issue?.sub).toBe(`${web.name} · 佐藤 美咲`);
    expect(issue?.marker).toEqual(login.status);
  });

  it('Wiki の補足は プロジェクト · 最終更新 {人}', () => {
    expect(rowOf(run({ input: 'ログイン' }), 'wiki')?.sub).toBe(
      `${web.name} · ${ja.rows.updatedBy('佐藤 美咲')}`,
    );
  });

  it('ページの補足は {プロジェクト名} · ページ、プロジェクトの補足は プロジェクト · {キー}', () => {
    expect(rowOf(run({ input: 'がんと' }), 'page')?.sub).toBe(`${web.name} · ${ja.rows.pageSub}`);
    expect(rowOf(run({ input: '#もば', stack: stackOf(space) }), 'project')?.sub).toBe(
      ja.rows.projectSub('MOB'),
    );
  });

  it('スペースは タイトル=表示名、補足=ホスト、バッジ=アイコン', () => {
    const row = rowOf(run({ stack: emptyStack }), 'space', nulab.label);
    expect(row?.sub).toBe(nulab.host);
    expect(row?.space).toEqual({ label: nulab.label, icon: nulab.icon });
  });

  it('スコープパスは段ごとにバッジとラベルを持ち、コマンド段はバッジを持たない', () => {
    const d = run({ stack: pushCommand(stackOf(space, project), switchSpaceCommand) });
    expect(d.view.path.map((p) => [p.label, p.badge])).toEqual([
      [nulab.label, true],
      [web.name, true],
      [switchSpaceCommand.label, false],
    ]);
  });
});
