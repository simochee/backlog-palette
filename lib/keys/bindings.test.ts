import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';
import type { RowView } from '@/components/types';

import { deriveBindings, type KeyState } from './bindings';

const row = (partial: Partial<RowView>): RowView => ({
  id: 'row',
  kind: 'page',
  title: 'ボード',
  hints: ['enter', 'modEnter', 'complete'],
  ...partial,
});

const base: KeyState = {
  selected: row({}),
  rowCount: 3,
  canPopStack: true,
  armedLabel: undefined,
  hasInput: false,
  hasResults: false,
  panelAvailable: true,
};

const ids = (state: Partial<KeyState>) =>
  deriveBindings({ ...base, ...state }, ja).map((b) => b.id);
const labelOf = (state: Partial<KeyState>, id: string) =>
  deriveBindings({ ...base, ...state }, ja).find((b) => b.id === id)?.label;

describe('↵ と ⇥ と ⌘↵', () => {
  it('選択行が動作を持つときだけ ↵ が出る', () => {
    expect(ids({})).toContain('enter');
    expect(ids({ selected: row({ kind: 'hint', hints: [] }) })).not.toContain('enter');
    expect(ids({ selected: undefined })).not.toContain('enter');
  });

  it('↵ の文言は行による: 検索行は「検索」、接続行と障害行は「接続」、コマンドは「適用」', () => {
    expect(labelOf({}, 'enter')).toBe(ja.keys.open);
    expect(labelOf({ selected: row({ kind: 'search', hints: ['enter'] }) }, 'enter')).toBe(
      ja.keys.search,
    );
    expect(labelOf({ selected: row({ kind: 'connect', hints: ['enter'] }) }, 'enter')).toBe(
      ja.keys.connect,
    );
    expect(labelOf({ selected: row({ kind: 'status', hints: ['enter'] }) }, 'enter')).toBe(
      ja.keys.connect,
    );
    expect(
      labelOf({ selected: row({ kind: 'command', hints: ['enter', 'complete'] }) }, 'enter'),
    ).toBe(ja.keys.apply);
  });

  it('⇥ は取り込める行があるときだけ出て、補完・積む・階層を開くで文言が変わる', () => {
    expect(labelOf({}, 'take')).toBe(ja.keys.complete);
    expect(labelOf({ selected: row({ kind: 'space', hints: ['enter', 'stack'] }) }, 'take')).toBe(
      ja.keys.stack,
    );
    expect(
      labelOf({ selected: row({ kind: 'command', hints: ['descend', 'stack'] }) }, 'take'),
    ).toBe(ja.keys.descend);
    expect(ids({ selected: row({ kind: 'search', hints: ['enter'] }) })).not.toContain('take');
  });

  it('⌘↵ は選択行が新しいタブに対応するときだけ出る', () => {
    expect(ids({})).toContain('modEnter');
    expect(ids({ selected: row({ hints: ['enter'] }) })).not.toContain('modEnter');
  });
});

describe('状態から出るキー', () => {
  it('行が 2 つ以上あるときだけ ↑↓ が出る', () => {
    expect(ids({ rowCount: 2 })).toContain('move');
    expect(ids({ rowCount: 1 })).not.toContain('move');
  });

  it('外せる段があるときだけ ⌫ が出て、削除待ちなら外す段の名前を含む', () => {
    expect(labelOf({}, 'back')).toBe(ja.keys.back);
    expect(labelOf({ armedLabel: 'Webリニューアル' }, 'back')).toBe(
      ja.keys.backArmed('Webリニューアル'),
    );
    expect(ids({ canPopStack: false })).not.toContain('back');
  });

  it('⌘→ は入力に語があるときだけ出て、パネルが使えない環境では出さない', () => {
    expect(ids({ hasInput: true })).toContain('toPanel');
    expect(ids({ hasInput: false })).not.toContain('toPanel');
    expect(ids({ hasInput: true, panelAvailable: false })).not.toContain('toPanel');
  });

  it('⌘⇧C は検索結果が出ているときだけ出る', () => {
    expect(ids({ hasResults: true })).toContain('copyUrl');
    expect(ids({})).not.toContain('copyUrl');
  });

  it('並びは ↵ > ↑↓ > ⌫ > ⇥ > ⌘↵ > ⌘→ > ⌘⇧C の優先順になる', () => {
    expect(ids({ hasInput: true, hasResults: true })).toEqual([
      'enter',
      'move',
      'back',
      'take',
      'modEnter',
      'toPanel',
      'copyUrl',
    ]);
  });

  it('文言は辞書から取る', () => {
    const bindings = deriveBindings({ ...base, hasInput: true, hasResults: true }, ja);
    const dictionary = new Set(Object.values(ja.keys).filter((v) => typeof v === 'string'));
    for (const binding of bindings) expect(dictionary.has(binding.label)).toBe(true);
  });
});
