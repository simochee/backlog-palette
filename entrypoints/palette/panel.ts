import { browser } from '#imports';
import { type SearchState, searchState } from '@/lib/share';
import type { Scope } from '@/lib/stack/types';
import { panelRequest } from '@/lib/storage/panel-items';
import { readCurrentTab } from '@/lib/tabs';

import { shareScopeOf } from './share.ts';

/*
 * Firefox はサイドバーをスクリプトから開けない（surfaces.md §5.5）。開けない環境では
 * ⌘→ と panel 行をフッターにも候補にも出さないので、ここへ来るのは開ける環境だけ。
 * それでも実行時に確かめるのは、判定（PANEL_AVAILABLE）と API の有無がずれたときに
 * 例外で落ちるより、渡すだけ渡して閉じない方が安全なため
 */
function canOpenPanel(): boolean {
  return 'sidePanel' in browser;
}

/** 語とスコープ（または条件つきの復元状態）をパネルへ渡して開く。渡せなければ false */
export async function handOffToPanel(state: SearchState): Promise<boolean> {
  if (!canOpenPanel()) return false;
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
