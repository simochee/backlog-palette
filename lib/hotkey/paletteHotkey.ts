export type HotkeyEvent = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'
>;

export function isMacPlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/iu.test(platform);
}

/**
 * パレットを開閉するキー。macOS は ⌘K、それ以外は Ctrl+K（surfaces.md §9）。
 *
 * 両方の修飾キーを常に受けると、macOS のテキスト入力で行末まで削除する
 * Ctrl+K や、Backlog 本体が使うかもしれない Ctrl 系のキーまで奪う。
 */
export function isPaletteHotkey(event: HotkeyEvent, platform: string): boolean {
  if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) return false;
  return isMacPlatform(platform)
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * Backlog 本体のテキスト入力にフォーカスがあるときは ⌘K を捕捉しない（D-21、仮の境界）。
 * 実機確認で境界を決めるまでの暫定で、input / textarea / contenteditable を対象にする。
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target instanceof HTMLElement && target.isContentEditable;
}
