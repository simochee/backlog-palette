import { browser } from '#imports';
import { sendMessage } from '@/lib/messaging/background';

import { createDelegatedFetch } from './delegatedFetch';

/*
 * Firefox の Web ページに埋めた拡張 iframe は content script 相当の権限で、browser.tabs が
 * 無く fetch は CORS を受ける（backlog-facts.md §5-16）。tabs の有無をその環境の目印にして
 * background に委譲する（D-33）。Chrome とサイドパネル・設定画面は直接撃つ。
 */
function canFetchDirectly(): boolean {
  return Reflect.get(browser, 'tabs') !== undefined;
}

const delegatedFetch = createDelegatedFetch((request) => sendMessage('fetchBacklog', request));

/** createSpaceClient に渡す fetch。委譲の切り替え点はここ 1 箇所 */
export const platformFetch: typeof globalThis.fetch = (input, init) =>
  canFetchDirectly() ? globalThis.fetch(input, init) : delegatedFetch(input, init);
