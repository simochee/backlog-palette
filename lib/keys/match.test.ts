import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';

import { deriveBindings } from './bindings';
import { type KeyEventLike, resolveBinding, toKeyHints } from './match';

const press = (key: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key,
  code: '',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

const bindings = deriveBindings(
  {
    selected: { id: 'r', kind: 'page', title: 'ボード', hints: ['enter', 'modEnter', 'complete'] },
    rowCount: 3,
    popLabel: 'Webリニューアル',
    hasInput: true,
    hasResults: false,
    panelAvailable: true,
  },
  ja,
);

describe('押されたキーの解決', () => {
  it('↓ と Ctrl+N はどちらも移動に届く', () => {
    expect(resolveBinding(press('ArrowDown'), bindings, 'mac')?.id).toBe('move');
    expect(resolveBinding(press('n', { ctrlKey: true }), bindings, 'mac')?.id).toBe('move');
  });

  it('mac では ⌘↵、Windows では Ctrl+↵ が新しいタブに届く', () => {
    expect(resolveBinding(press('Enter', { metaKey: true }), bindings, 'mac')?.id).toBe('modEnter');
    expect(resolveBinding(press('Enter', { ctrlKey: true }), bindings, 'windows')?.id).toBe(
      'modEnter',
    );
  });

  it('修飾キーの無い ↵ は「開く」に届き、⌘↵ とは区別される', () => {
    expect(resolveBinding(press('Enter'), bindings, 'mac')?.id).toBe('enter');
  });

  it('フッターに出ていないキーはどの動作にも解決されない', () => {
    expect(
      resolveBinding(press('c', { metaKey: true, shiftKey: true }), bindings, 'mac'),
    ).toBeUndefined();
  });
});

describe('フッターの表示', () => {
  it('mac では ⌘、Windows / Linux では Ctrl として出す', () => {
    const mac = toKeyHints(bindings, 'mac').find((h) => h.id === 'modEnter');
    const win = toKeyHints(bindings, 'windows').find((h) => h.id === 'modEnter');
    const linux = toKeyHints(bindings, 'linux').find((h) => h.id === 'modEnter');
    expect(mac?.keys).toEqual(['⌘', '↵']);
    expect(win?.keys).toEqual(['Ctrl', '↵']);
    expect(linux?.keys).toEqual(['Ctrl', '↵']);
  });

  it('↑↓ は 2 つのキーを並べ、同義の Ctrl+N / Ctrl+P は表示しない', () => {
    expect(toKeyHints(bindings, 'mac').find((h) => h.id === 'move')?.keys).toEqual(['↑', '↓']);
  });

  it('⌫ ⇥ ⌘→ は記号で出す', () => {
    const hints = toKeyHints(bindings, 'mac');
    expect(hints.find((h) => h.id === 'back')?.keys).toEqual(['⌫']);
    expect(hints.find((h) => h.id === 'take')?.keys).toEqual(['⇥']);
    expect(hints.find((h) => h.id === 'toPanel')?.keys).toEqual(['⌘', '→']);
  });

  it('文言と優先順は binding のものをそのまま持つ', () => {
    const hint = toKeyHints(bindings, 'mac').find((h) => h.id === 'enter');
    expect(hint?.label).toBe(ja.keys.open);
    expect(hint?.priority).toBe(0);
  });
});
