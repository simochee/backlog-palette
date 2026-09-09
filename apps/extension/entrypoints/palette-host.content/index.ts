import { browser } from 'wxt/browser';
import { createIframeUi } from 'wxt/utils/content-script-ui/iframe';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendMessage } from '../../src/messaging/ext.ts';
import { isFromIframe, type PageContext, type ToIframe } from '../../src/messaging/window.ts';
import { readPageScope, readVisitedPage } from '../../src/services/pageContext.ts';

function readPageContext(): PageContext {
  const scope = readPageScope(window.location.href);
  const issue = /\/view\/([A-Z][A-Z0-9_]*-\d+)/.exec(window.location.pathname)?.[1];

  return {
    origin: window.location.origin,
    ...scope,
    ...(issue === undefined ? {} : { issueKey: issue }),
  };
}

export default defineContentScript({
  matches: ['https://*.backlog.jp/*', 'https://*.backlog.com/*', 'https://*.backlogtool.com/*'],
  // apex と www はスペースではない（wxt.config.ts の NOT_A_SPACE と同じ理由）
  excludeMatches: [
    'https://backlog.jp/*',
    'https://www.backlog.jp/*',
    'https://backlog.com/*',
    'https://www.backlog.com/*',
    'https://backlogtool.com/*',
    'https://www.backlogtool.com/*',
    'https://support-ja.backlog.com/*',
    'https://support-en.backlog.com/*',
  ],

  main(ctx) {
    const extensionOrigin = new URL(browser.runtime.getURL('/')).origin;
    let iframeEl: HTMLIFrameElement | undefined;
    let wrapperEl: HTMLElement | undefined;
    let isOpen = false;
    let isLoaded = false;
    let hasPendingOpen = false;

    const ui = createIframeUi(ctx, {
      page: '/palette.html',
      /*
       * 'overlay' ではなく 'modal'。overlay は wrapper に width:0 / height:0 を
       * 付けたうえで iframe を position:absolute にするため、iframe が 0×0 に潰れる。
       * modal は iframe 自体を position:fixed の全面にしてくれる。
       */
      position: 'modal',
      zIndex: 2_147_483_647,
      anchor: 'body',
      onMount(wrapper, iframe) {
        wrapperEl = wrapper;
        iframeEl = iframe;

        /*
         * 初回 ⌘K のロード待ちを消すため、非表示のまま先に注入する（§14）。
         *
         * iframe はビューポート全面にする。暗転・中央寄せ・外側クリックの判定を
         * すべて拡張ページの内側で完結させられるので、ページのレイアウトに触らず、
         * 高さ同期も要らなくなる。
         */
        wrapper.style.display = 'none';
        /*
         * iframe には既定サイズ（300x150）が効くため、position:fixed に
         * inset:0 が付いていても引き伸ばされない。幅高さを明示する。
         */
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';
        iframe.style.colorScheme = 'normal';

        /*
         * 先読み注入なので、初回 ⌘K が load より先に来ることがある。
         * その場合は open を保留し、読み込み完了後に開く。
         */
        iframe.addEventListener('load', () => {
          isLoaded = true;
          if (import.meta.env.DEV) console.debug('[bp] palette iframe を読み込んだ');
          if (hasPendingOpen) {
            hasPendingOpen = false;
            open();
          }
        });
      },
    });

    ui.mount();

    const send = (message: ToIframe) => {
      iframeEl?.contentWindow?.postMessage(message, extensionOrigin);
    };

    const open = () => {
      if (wrapperEl === undefined) return;

      if (!isLoaded) {
        hasPendingOpen = true;
        isOpen = true;
        if (import.meta.env.DEV) console.debug('[bp] iframe の読み込み待ち。open を保留した');
        return;
      }

      wrapperEl.style.display = 'block';
      isOpen = true;
      /*
       * 親からも iframe 要素にフォーカスを移す。iframe の中で input.focus() を
       * 呼ぶだけでは、ページ側にフォーカスされた要素が残っているときに
       * トップレベルのフォーカスが移らないことがある。
       */
      iframeEl?.focus();
      // フォーカスは iframe 自身が受け取る。ページ側からは触らない（§9.4）
      send({ t: 'open', ctx: readPageContext() });
    };

    const close = () => {
      if (wrapperEl === undefined) return;
      wrapperEl.style.display = 'none';
      // 読み込み待ちの間に閉じられたら、読み込み完了後に開き直さない
      hasPendingOpen = false;
      isOpen = false;
      /*
       * 隠すだけでなく iframe にも閉じたことを伝える。伝えないと iframe は
       * 開いたままの状態を保持し、次に開いたときに再マウントが起きない。
       */
      send({ t: 'close' });
    };

    const toggle = () => {
      if (isOpen) {
        close();
      } else {
        open();
      }
    };

    /*
     * commands にショートカットが割り当たっていれば、キーはブラウザが消費し、
     * ページに keydown は届かない（通常はこちらが本線）。
     * これは chrome://extensions/shortcuts で解除された場合の保険。
     */
    ctx.addEventListener(window, 'keydown', (event) => {
      const isPaletteKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isPaletteKey) return;

      if (import.meta.env.DEV) console.debug('[bp] keydown 経路で ⌘K を受けた');

      event.preventDefault();
      event.stopPropagation();
      toggle();
    });

    ctx.addEventListener(window, 'message', (event) => {
      // 送信元が自分の iframe であることと、拡張オリジンであることの両方を確認する
      if (event.source !== iframeEl?.contentWindow) return;
      if (event.origin !== extensionOrigin) return;
      if (!isFromIframe(event.data)) return;

      close();
    });

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      if ((message as { t?: unknown }).t !== 'open-palette') return;

      if (import.meta.env.DEV) console.debug('[bp] commands 経路で ⌘K を受けた');
      toggle();
    });

    /*
     * 閲覧を記録する。API は呼ばず、URL と document.title だけを見る（§9）。
     * SPA 遷移でタイトルの更新が遅れる形式があるため（未決 #8）、
     * 記録は SW に投げっぱなしにし、失敗しても閲覧の邪魔をしない。
     */
    const visited = readVisitedPage(window.location.href, document.title);
    if (visited !== undefined) {
      sendMessage('recordVisit', visited).catch(() => {
        // SW が起動していない瞬間に当たりうる。次の閲覧で記録されればよい
      });
    }

    if (import.meta.env.DEV) {
      console.debug('[bp] content script を注入した', window.location.origin);
    }
  },
});
