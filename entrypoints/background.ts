import { browser, defineBackground } from '#imports';
import { restoreCustomHosts } from '@/lib/backlog/customDomainsRegistry';
import { serializeResponse } from '@/lib/backlog/delegatedFetch';
import { isKnownSpaceOrigin } from '@/lib/backlog/spaceOrigins';
import { onMessage } from '@/lib/messaging/background';
import type { CurrentTab } from '@/lib/tabs/types';
import { pruneDisplayCache } from '@/lib/visits/record';

const PRUNE_DISPLAY_CACHE = 'prune-display-cache';

type SidebarAction = {
  toggle: () => void;
  isOpen: (windowId: number | undefined) => Promise<boolean>;
};

/*
 * Firefox は side_panel を知らず sidebar_action で出す（surfaces.md §7）。
 * WXT の browser 型は Chrome 基準なので sidebarAction は型に無く、実行時に確かめる。
 */
function readSidebarAction(): SidebarAction | undefined {
  const value: unknown = Reflect.get(browser, 'sidebarAction');
  if (typeof value !== 'object' || value === null) return undefined;
  const toggle: unknown = Reflect.get(value, 'toggle');
  const isOpen: unknown = Reflect.get(value, 'isOpen');
  if (typeof toggle !== 'function' || typeof isOpen !== 'function') return undefined;
  return {
    toggle: () => {
      Reflect.apply(toggle, value, []);
    },
    isOpen: async (windowId) => Boolean(await Reflect.apply(isOpen, value, [{ windowId }])),
  };
}

/*
 * Service Worker は薄く保つ（tech-stack.md §2）。UI・検索・API 呼び出しは持たず、
 * インストール時の初期化と alarms、ツールバーのアイコンだけを受ける。
 */
/*
 * @webext-core/messaging は sender を chrome.runtime.MessageSender と型付けするが、
 * WXT の browser 型にはグローバルの chrome 名前空間が無く解決できない。
 * 型を当てにせず、実行時に形を確かめて読む。
 */
function readSenderTab(sender: unknown): CurrentTab | undefined {
  if (typeof sender !== 'object' || sender === null) return undefined;
  const tab: unknown = Reflect.get(sender, 'tab');
  if (typeof tab !== 'object' || tab === null) return undefined;
  const id: unknown = Reflect.get(tab, 'id');
  const url: unknown = Reflect.get(tab, 'url');
  return {
    id: typeof id === 'number' ? id : undefined,
    url: typeof url === 'string' ? url : undefined,
  };
}

function readSenderWindowId(sender: unknown): number | undefined {
  if (typeof sender !== 'object' || sender === null) return undefined;
  const tab: unknown = Reflect.get(sender, 'tab');
  if (typeof tab !== 'object' || tab === null) return undefined;
  const windowId: unknown = Reflect.get(tab, 'windowId');
  return typeof windowId === 'number' ? windowId : undefined;
}

/** browser.tabs を持たないコンテキスト（Firefox の埋め込み iframe）からの委譲を受ける */
function serveTabsDelegation() {
  // 送り主の載っているタブは sender から読む。メッセージに載せた値は信じない（I7）
  onMessage('readCurrentTab', (message) => readSenderTab(message.sender));
  onMessage('navigate', async (message) => {
    const tabId = readSenderTab(message.sender)?.id;
    if (message.data.target === 'new' || tabId === undefined) {
      await browser.tabs.create({ url: message.data.url });
      return;
    }
    await browser.tabs.update(tabId, { url: message.data.url });
  });
  onMessage('isSidebarOpen', async (message) => {
    const sidebarAction = readSidebarAction();
    if (sidebarAction === undefined) return false;
    return sidebarAction.isOpen(readSenderWindowId(message.sender));
  });
}

/**
 * fetch を持てないコンテキスト（Firefox の埋め込み iframe）からの委譲を受ける（D-33）。
 * 任意 URL の中継にはしない。Backlog のスペースの origin だけを撃つ。
 * リクエストのヘッダには鍵が載っているので、ここで内容をログに出さない。
 */
function serveFetchDelegation() {
  onMessage('fetchBacklog', async ({ data }) => {
    if (!(await isKnownSpaceOrigin(new URL(data.url).origin))) {
      throw new Error('Backlog のスペース以外には委譲しない');
    }
    const response = await fetch(data.url, {
      method: data.method,
      headers: data.headers,
      ...(data.body === undefined ? {} : { body: data.body }),
    });
    return serializeResponse(response);
  });
}

/** Backlog のタブではサイドパネルを開く。それ以外のタブは設定画面（surfaces.md §4。設定画面は後続の PR） */
async function openSurfaceFor(tab: { id?: number; url?: string }): Promise<void> {
  if (tab.id === undefined || tab.url === undefined) return;
  if (!(await isKnownSpaceOrigin(new URL(tab.url).origin))) {
    await browser.runtime.openOptionsPage();
    return;
  }
  const sidebarAction = readSidebarAction();
  if (sidebarAction !== undefined) {
    sidebarAction.toggle();
    return;
  }
  await browser.sidePanel.open({ tabId: tab.id });
}

export default defineBackground(() => {
  serveTabsDelegation();
  serveFetchDelegation();

  browser.runtime.onInstalled.addListener(() => {
    void browser.alarms.create(PRUNE_DISPLAY_CACHE, { periodInMinutes: 24 * 60 });
    void restoreCustomHosts();
  });
  // 動的登録は persistAcrossSessions だが、権限の変化や更新で外れることがある。起動ごとに揃える
  browser.runtime.onStartup.addListener(() => {
    void restoreCustomHosts();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PRUNE_DISPLAY_CACHE) void pruneDisplayCache();
  });

  browser.action.onClicked.addListener((tab) => {
    void openSurfaceFor(tab);
  });
});
