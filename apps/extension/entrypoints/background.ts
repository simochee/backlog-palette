import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { onMessage, sendEvent } from '../src/messaging/ext.ts';
import { isTrustedPageOrigin } from '../src/messaging/window.ts';
import { recordActivity } from '../src/services/activity/index.ts';
import { disconnect } from '../src/services/auth/connect.ts';
import { buildAssignedSection, buildBootstrap } from '../src/services/bootstrap.ts';
import { connectSpace } from '../src/services/connectSpace.ts';
import { readPageScope } from '../src/services/pageContext.ts';
import { runSearch } from '../src/services/search/index.ts';
import { recordVisit } from '../src/services/visit.ts';

/**
 * M0 スパイク: ⌘K からパレットを開くまでの経路を通す。
 *
 * 本実装では認証・検索・遷移をここに置く。パレット UI からは
 * runtime.sendMessage 経由でしか呼べない（実装プラン §6.1）。
 */
async function navigateTo(href: string, target: 'currentTab' | 'newTab'): Promise<void> {
  const url = new URL(href);
  if (!isTrustedPageOrigin(url.origin)) return;

  if (target === 'newTab') {
    await browser.tabs.create({ url: url.href });
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) await browser.tabs.update(tab.id, { url: url.href });
}

export default defineBackground(() => {
  /*
   * 走っている検索を requestId で持つ。打鍵し直すたびに前の検索を止めないと、
   * 古い結果が新しい結果に混ざる。
   */
  const running = new Map<string, AbortController>();

  onMessage('startSearch', async ({ data }) => {
    running.get(data.requestId)?.abort();
    const controller = new AbortController();
    running.set(data.requestId, controller);

    try {
      await runSearch(
        data.state,
        (chunk) => {
          // 送信先は拡張ページ。失敗しても検索そのものは止めない
          void sendEvent('searchChunk', { requestId: data.requestId, ...chunk }).catch(
            () => undefined,
          );
        },
        { signal: controller.signal },
      );
    } finally {
      running.delete(data.requestId);
    }
  });

  onMessage('cancelSearch', ({ data }) => {
    running.get(data)?.abort();
    running.delete(data);
  });

  onMessage('connectSpace', ({ data }) => connectSpace(data, Date.now()));
  onMessage('disconnectSpace', ({ data }) => disconnect(data));

  onMessage('getBootstrap', ({ data }) => buildBootstrap(data.surface, data.ctx, Date.now()));

  onMessage('getActiveContext', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url === undefined) return undefined;

    const scope = readPageScope(tab.url);
    if (scope.spaceKey === undefined) return undefined;

    return { origin: new URL(tab.url).origin, ...scope };
  });
  onMessage('getAssignedIssues', ({ data }) => buildAssignedSection(data, Date.now()));

  /*
   * 行の実行。遷移は SW が行うが、クリップボードは Service Worker から
   * 書けない（navigator.clipboard が無く、DOM も持たない）。コピーだけは
   * 呼び出した拡張ページに返して、そちらで書き込ませる。
   */
  onMessage('runRowAction', async ({ data }) => {
    /*
     * 記録は遷移より先に済ませる。遷移を待つと、その間に Service Worker が
     * 止められたときに書き込みごと失われる。
     */
    if (data.entryId !== undefined) {
      await recordActivity({ entityId: data.entryId, kind: 'selected', at: Date.now() });
    }

    if (data.kind === 'navigate') {
      await navigateTo(data.url, data.target ?? 'currentTab');
    }
  });

  onMessage('recordVisit', ({ data }) => recordVisit(data, Date.now()));

  /*
   * 遷移は SW が行う。ページ側のスクリプトに location を触らせない（§2.3）。
   * 受け取るのは URL だけなので、拡張が組み立てたもの以外が来ないよう
   * オリジンを確認してから開く。
   */
  onMessage('navigate', ({ data }) => navigateTo(data.url, data.target));

  /*
   * サイドパネルはツールバーのアイコンからも開けるようにする。
   * sidePanel.open() はユーザー操作起点でしか呼べないため、
   * 起点を 2 つ用意しておくと commands 経路が使えない環境でも到達できる。
   */
  if (browser.sidePanel !== undefined) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      // Firefox には sidePanel が無い。sidebar_action が同じ役割を担う
    });
  }

  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'open-panel') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId === undefined) return;

      /*
       * 未決 #6 の検証点: commands のハンドラがユーザー操作起点として
       * 認められるか。認められない場合 open() は
       * 「`sidePanel.open()` may only be called in response to a user gesture」
       * で reject する。
       */
      try {
        await browser.sidePanel?.open({ windowId: tab.windowId });
        if (import.meta.env.DEV) console.debug('[bp] commands から sidePanel を開けた');
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('[bp] commands から sidePanel を開けなかった:', String(error));
        }
      }
      return;
    }

    if (command !== 'open-palette') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;

    /*
     * 遷移も開閉もタブ側の DOM を経由せず、拡張から指示する。
     *
     * Backlog のスペース以外には content script がいないので送信は失敗する。
     * 握り潰すと「⌘K を押しても何も起きない」ように見えて原因に辿れないため、
     * 開発時は理由をログに残す。ユーザー向けの導線（Backlog 外から開く）は Phase 2。
     */
    try {
      await browser.tabs.sendMessage(tab.id, { t: 'open-palette' });
    } catch {
      if (import.meta.env.DEV) {
        console.debug(
          '[bp] このタブにはパレットがいない（Backlog のスペースではない）:',
          tab.url ?? '(url 不明)',
        );
      }
    }
  });

  if (import.meta.env.DEV) {
    browser.commands.getAll().then((commands) => {
      const palette = commands.find((c) => c.name === 'open-palette');
      console.debug(
        '[bp] ショートカットの割り当て:',
        palette?.shortcut === '' || palette?.shortcut === undefined
          ? '未割り当て（chrome://extensions/shortcuts で確認。他の拡張と衝突している可能性）'
          : palette.shortcut,
      );
    });
  }
});
