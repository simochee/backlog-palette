import { browser } from '#imports';

export type CurrentTab = { id: number | undefined; url: string | undefined };

/**
 * 拡張ページが自分の載っているタブを読む。どのスペースの鍵を使うかはこの URL で
 * 決める（I7）。ページから postMessage で届いた値は使わない。
 *
 * Web ページに埋めた iframe では tabs.getCurrent() が自分のタブを返す。
 * サイドパネルはタブに属さないので undefined になり、アクティブなタブに落とす。
 */
export async function readCurrentTab(): Promise<CurrentTab | undefined> {
  const own = await browser.tabs.getCurrent();
  const tab = own ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (tab === undefined) return undefined;
  return { id: tab.id, url: tab.url };
}

export type NavigateTarget = 'current' | 'new';

/** 遷移は拡張ページから tabs API で行い、ページ側を経由しない（tech-stack.md §2） */
export async function navigate(url: string, target: NavigateTarget = 'current'): Promise<void> {
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
