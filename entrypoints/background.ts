import { browser, defineBackground } from '#imports';
import { isBacklogSpaceOrigin } from '@/lib/backlog/host';
import { pruneDisplayCache } from '@/lib/visits/record';

const PRUNE_DISPLAY_CACHE = 'prune-display-cache';

type SidebarAction = { toggle: () => void };

/*
 * Firefox は side_panel を知らず sidebar_action で出す（surfaces.md §7）。
 * WXT の browser 型は Chrome 基準なので sidebarAction は型に無く、実行時に確かめる。
 */
function readSidebarAction(): SidebarAction | undefined {
  const value: unknown = Reflect.get(browser, 'sidebarAction');
  if (typeof value !== 'object' || value === null) return undefined;
  const toggle: unknown = Reflect.get(value, 'toggle');
  if (typeof toggle !== 'function') return undefined;
  return {
    toggle: () => {
      Reflect.apply(toggle, value, []);
    },
  };
}

/*
 * Service Worker は薄く保つ（tech-stack.md §2）。UI・検索・API 呼び出しは持たず、
 * インストール時の初期化と alarms、ツールバーのアイコンだけを受ける。
 */
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.alarms.create(PRUNE_DISPLAY_CACHE, { periodInMinutes: 24 * 60 });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PRUNE_DISPLAY_CACHE) void pruneDisplayCache();
  });

  // Backlog のタブではサイドパネルを開く。それ以外のタブは設定画面（surfaces.md §4。設定画面は後続の PR）
  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined || tab.url === undefined) return;
    if (!isBacklogSpaceOrigin(new URL(tab.url).origin)) return;
    const sidebarAction = readSidebarAction();
    if (sidebarAction !== undefined) {
      sidebarAction.toggle();
      return;
    }
    void browser.sidePanel.open({ tabId: tab.id });
  });
});
