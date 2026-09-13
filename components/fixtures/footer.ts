import type { Labels } from '@/components/labels';
import type { KeyHint, KeyHintId } from '@/components/types';

type HintOverrides = Partial<Record<KeyHintId, string>>;

const keys: Record<KeyHintId, readonly string[]> = {
  enter: ['↵'],
  move: ['↑', '↓'],
  back: ['⌫'],
  take: ['⇥'],
  modEnter: ['⌘', '↵'],
  toPanel: ['⌘', '→'],
  copyUrl: ['⌘', '⇧', 'C'],
};

/** フッターの優先順（palette.md §6）。小さいほど残る */
const priority: Record<KeyHintId, number> = {
  enter: 0,
  move: 1,
  back: 2,
  take: 3,
  modEnter: 4,
  toPanel: 5,
  copyUrl: 6,
};

function defaultLabel(id: KeyHintId, labels: Labels): string {
  const byId: Record<KeyHintId, string> = {
    enter: labels.keys.open,
    move: labels.keys.move,
    back: labels.keys.back,
    take: labels.keys.complete,
    modEnter: labels.keys.newTab,
    toPanel: labels.keys.toPanel,
    copyUrl: labels.keys.copyUrl,
  };
  return byId[id];
}

export function footerHints(
  ids: readonly KeyHintId[],
  labels: Labels,
  overrides: HintOverrides = {},
): KeyHint[] {
  return ids.map((id) => ({
    id,
    keys: keys[id],
    label: overrides[id] ?? defaultLabel(id, labels),
    priority: priority[id],
  }));
}

export const allHintIds: readonly KeyHintId[] = [
  'enter',
  'move',
  'back',
  'take',
  'modEnter',
  'toPanel',
  'copyUrl',
];
