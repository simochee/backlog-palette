import { browser } from '#imports';
import { sendMessage } from '@/lib/messaging/background';
import { sendMessage as sendToContent } from '@/lib/messaging/content';
import type { CurrentTab, NavigateTarget } from '@/lib/tabs/types';

export type { CurrentTab, NavigateTarget } from '@/lib/tabs/types';

/*
 * Firefox の Web ページに埋めた拡張 iframe は content script 相当の権限で、
 * browser.tabs が無い（backlog-facts.md §5-16）。その場合は background に委譲する。
 */
function hasTabsApi(): boolean {
  return Reflect.get(browser, 'tabs') !== undefined;
}

/**
 * 拡張ページが自分の載っているタブを読む。どのスペースの鍵を使うかはこの URL で
 * 決める（I7）。ページから postMessage で届いた値は使わない。
 *
 * Web ページに埋めた iframe では tabs.getCurrent() が自分のタブを返す。
 * サイドパネルはタブに属さないので undefined になり、アクティブなタブに落とす。
 */
export async function readCurrentTab(): Promise<CurrentTab | undefined> {
  if (!hasTabsApi()) return sendMessage('readCurrentTab');
  const own = await browser.tabs.getCurrent();
  const tab = own ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (tab === undefined) return undefined;
  return { id: tab.id, url: tab.url };
}

/** 遷移は拡張ページから tabs API で行い、ページ側を経由しない（tech-stack.md §2） */
export async function navigate(url: string, target: NavigateTarget = 'current'): Promise<void> {
  if (!hasTabsApi()) {
    await sendMessage('navigate', { url, target });
    return;
  }
  if (target === 'new') {
    await browser.tabs.create({ url });
    return;
  }
  const tab = await readCurrentTab();
  if (tab?.id === undefined) {
    await browser.tabs.create({ url });
    return;
  }
  await browser.tabs.update(tab.id, { url });
}

/**
 * アクティブなタブのパレットを開く。Backlog 以外のタブには content script が居らず
 * 受け手が無いので、送れなかったことは失敗として扱わない（⌘K を奪わない面、D-10）
 */
export async function openPaletteInCurrentTab(): Promise<void> {
  const tab = await readCurrentTab();
  if (tab?.id === undefined) return;
  await sendToContent('openPalette', undefined, tab.id).catch(() => undefined);
}

/**
 * Firefox のサイドバーが開いているか。サイドバーはスクリプトから開けないので、⌘→ と
 * panel 行は開いているときだけ出す（surfaces.md §5.5）。埋め込み iframe は sidebarAction を
 * 持たないので background に訊く
 */
export function isSidebarOpen(): Promise<boolean> {
  return sendMessage('isSidebarOpen');
}
