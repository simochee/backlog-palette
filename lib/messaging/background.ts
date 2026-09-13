import { defineExtensionMessaging } from '@webext-core/messaging';

import type { CurrentTab, NavigateTarget } from '@/lib/tabs/types';

/**
 * 拡張ページ → background の通信路。型と protocol だけを置き、実装は持たない。
 *
 * Firefox では Web ページに埋めた拡張 iframe から browser.tabs が使えない
 * （backlog-facts.md §5-16）。使えないコンテキストはここを通して background に委譲する。
 * M4 の API 呼び出しの委譲（D-33）もこの protocol に足す。
 */
export type BackgroundProtocol = {
  /** 送り主が載っているタブ。background は sender.tab から読むので、ページの申告は使わない（I7） */
  readCurrentTab(): CurrentTab | undefined;
  navigate(data: { url: string; target: NavigateTarget }): void;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<BackgroundProtocol>();
