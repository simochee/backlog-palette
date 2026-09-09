import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

/**
 * M0 スパイク: ⌘K からパレットを開くまでの経路を通す。
 *
 * 本実装では認証・検索・遷移をここに置く。パレット UI からは
 * runtime.sendMessage 経由でしか呼べない（実装プラン §6.1）。
 */
export default defineBackground(() => {
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
