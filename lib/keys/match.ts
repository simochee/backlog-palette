import { detectPlatform, formatForDisplay, matchesKeyboardEvent } from '@tanstack/hotkeys';

import type { KeyHint } from '@/components/types';

import type { KeyBinding } from './bindings';

/**
 * @tanstack/hotkeys は alpha なので、使う関数をこのファイルの 2 つ（照合と表示）に閉じる
 * （tech-stack.md §4）。HotkeyManager は使わず、捕捉ループは presenter が握る。
 */
export type Platform = 'mac' | 'windows' | 'linux';

export type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
>;

export { detectPlatform };

export function matchesBinding(
  event: KeyEventLike,
  binding: KeyBinding,
  platform: Platform,
): boolean {
  // matchesKeyboardEvent は KeyboardEvent を要求するが、読むのは KeyEventLike の 6 プロパティだけ。
  // node には KeyboardEvent が無く、本物のイベントを要求するとテストが書けないので、ここでだけ型を広げる
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const keyboardEvent = event as KeyboardEvent;
  return binding.hotkeys.some((hotkey) => matchesKeyboardEvent(keyboardEvent, hotkey, platform));
}

/** 上から照合して最初に合ったものを返す。出ていないキーはどれにも解決されない（I2） */
export function resolveBinding(
  event: KeyEventLike,
  bindings: readonly KeyBinding[],
  platform: Platform,
): KeyBinding | undefined {
  return bindings.find((binding) => matchesBinding(event, binding, platform));
}

/** Windows / Linux では ⌘ を Ctrl として出す */
function displayKeys(binding: KeyBinding, platform: Platform): string[] {
  const separator = platform === 'mac' ? ' ' : '+';
  return binding.display.flatMap((hotkey) =>
    formatForDisplay(hotkey, { platform, separatorToken: separator }).split(separator),
  );
}

export function toKeyHints(bindings: readonly KeyBinding[], platform: Platform): KeyHint[] {
  return bindings.map((binding) => ({
    id: binding.id,
    keys: displayKeys(binding, platform),
    label: binding.label,
    ...(binding.shortLabel === undefined ? {} : { shortLabel: binding.shortLabel }),
    priority: binding.priority,
  }));
}
