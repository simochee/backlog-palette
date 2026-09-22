import { browser } from '#imports';
import { type SearchState, searchState } from '@/lib/share';
import type { Scope } from '@/lib/stack/types';
import { panelRequest } from '@/lib/storage/panel-items';
import { isSidebarOpen, readCurrentTab } from '@/lib/tabs';

import { shareScopeOf } from './share.ts';

function canOpenPanel(): boolean {
  return 'sidePanel' in browser;
}

/** パネルへ渡せるか。Chrome はいつでも開ける。Firefox は開いているサイドバーにだけ渡せる（surfaces.md §5.5） */
export async function isPanelAvailable(): Promise<boolean> {
  return canOpenPanel() || (await isSidebarOpen());
}

/**
 * 語とスコープ（または条件つきの復元状態）をパネルへ渡して開く。渡せなければ false。
 * Firefox の開いているサイドバーは panelRequest を watch しているので、書くだけで届く
 */
export async function handOffToPanel(state: SearchState): Promise<boolean> {
  if (!canOpenPanel()) {
    if (!(await isSidebarOpen())) return false;
    await panelRequest.setValue({ state, at: Date.now() });
    return true;
  }
  await panelRequest.setValue({ state, at: Date.now() });
  const tab = await readCurrentTab();
  if (tab?.id === undefined) return false;
  await browser.sidePanel.open({ tabId: tab.id });
  return true;
}

/** `⌘→` と 0 件時の panel 行。入力の語と現在のスコープを渡す（palette.md §6・§7.5） */
export function openPanelWith(query: string, scope: Scope): Promise<boolean> {
  const shareScope = shareScopeOf(scope);
  if (shareScope === undefined) return Promise.resolve(false);
  return handOffToPanel(searchState(query, shareScope));
}
