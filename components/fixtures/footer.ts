import type { Labels } from '@/components/labels';
import type { KeyHint, KeyHintId, PathSegmentView, RowHint, SectionView } from '@/components/types';

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

type FooterContext = {
  path: readonly PathSegmentView[];
  input: string;
  sections: readonly SectionView[];
  selectedId?: string;
  hasResults?: boolean;
  enterLabel?: string;
};

function takeLabel(hints: readonly RowHint[], labels: Labels): string | undefined {
  if (hints.includes('stack')) return labels.keys.stack;
  if (hints.includes('complete')) return labels.keys.complete;
  return undefined;
}

/**
 * container が KeyBinding から導出するフッターを、フィクスチャ用に状態から組む（不変条件 I2）。
 * 出ているキーは必ず動作を持つ、という対応を story でも崩さないためにここで一元化する。
 */
export function deriveFooter(labels: Labels, context: FooterContext): KeyHint[] {
  const rows = context.sections.flatMap((section) => section.rows);
  const selected = rows.find((row) => row.id === context.selectedId);
  const hints = selected?.hints ?? [];
  const ids: KeyHintId[] = [];
  const overrides: HintOverrides = {};

  if (hints.length > 0) {
    ids.push('enter');
    if (context.enterLabel !== undefined) overrides.enter = context.enterLabel;
    else if (selected?.kind === 'search') overrides.enter = labels.keys.search;
    else if (selected?.kind === 'connect' || selected?.kind === 'status')
      overrides.enter = labels.keys.connect;
  }
  if (rows.length > 1) ids.push('move');
  const armed = context.path.find((segment) => segment.armed === true);
  if (context.path.length > 0 && context.path[0]?.id !== 'root') {
    ids.push('back');
    if (armed !== undefined) overrides.back = labels.keys.backArmed(armed.label);
  }
  const take = takeLabel(hints, labels);
  if (take !== undefined) {
    ids.push('take');
    overrides.take = take;
  }
  if (hints.includes('modEnter')) ids.push('modEnter');
  if (context.input !== '') ids.push('toPanel');
  if (context.hasResults === true) ids.push('copyUrl');

  return footerHints(ids, labels, overrides);
}
