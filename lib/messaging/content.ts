import { defineExtensionMessaging } from '@webext-core/messaging';

/**
 * 拡張ページ → タブの content script の通信路。パネルの ⌘K でタブのパレットを開く
 * （surfaces.md §5.4、P1）。パレットの iframe を開閉できるのは埋め込んだ content script だけ
 */
export type ContentProtocol = {
  openPalette(): void;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ContentProtocol>();
