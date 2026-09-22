import { defineExtensionMessaging } from '@webext-core/messaging';

import type { DelegatedRequest, DelegatedResponse } from '@/lib/backlog/delegatedFetch';
import type { CurrentTab, NavigateTarget } from '@/lib/tabs/types';

/**
 * 拡張ページ → background の通信路。型と protocol だけを置き、実装は持たない。
 *
 * Firefox では Web ページに埋めた拡張 iframe から browser.tabs が使えない
 * （backlog-facts.md §5-16）。使えないコンテキストはここを通して background に委譲する。
 * API 呼び出しの委譲（D-33）も同じ理由でここを通る。
 */
export type BackgroundProtocol = {
  /** 送り主が載っているタブ。background は sender.tab から読むので、ページの申告は使わない（I7） */
  readCurrentTab(): CurrentTab | undefined;
  navigate(data: { url: string; target: NavigateTarget }): void;
  /** 送り主のタブがあるウィンドウでサイドバーが開いているか。Firefox だけが答える（surfaces.md §5.5） */
  isSidebarOpen(): boolean;
  /** Backlog のスペースへの fetch。鍵はヘッダに載って通るが、background は拡張オリジンの内側（I7） */
  fetchBacklog(data: DelegatedRequest): DelegatedResponse;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<BackgroundProtocol>();
