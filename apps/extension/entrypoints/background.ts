import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

/**
 * M0 スパイク: ⌘K からパレットを開くまでの経路を通す。
 *
 * 本実装では認証・検索・遷移をここに置く。パレット UI からは
 * runtime.sendMessage 経由でしか呼べない（実装プラン §6.1）。
 */
export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'open-palette') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;

    // 遷移も開閉もタブ側の DOM を経由せず、拡張から指示する
    await browser.tabs.sendMessage(tab.id, { t: 'open-palette' }).catch(() => {
      // Backlog 以外のタブには content script がいない。将来はポップアップで開く
    });
  });
});
