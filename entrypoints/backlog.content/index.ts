import { browser, defineContentScript } from '#imports';
import type { ContentScriptContext } from '#imports';
import { BACKLOG_SPACE_MATCHES, NOT_A_SPACE_MATCHES, spaceKeyOf } from '@/lib/backlog/host';
import { isPaletteHotkey, isTextEntryTarget } from '@/lib/hotkey/paletteHotkey';
import { isFromIframe, type PageContext, type ToIframe } from '@/lib/messaging/window';
import { SHARE_FRAGMENT_KEY } from '@/lib/share';
import { readBacklogTheme } from '@/lib/theme/backlogTheme';
import { readVisitedPage } from '@/lib/visits/page';
import { recordVisit } from '@/lib/visits/record';

import { setupConnectPage } from './connect.ts';
import { summaryFromTitle } from './title.ts';

/*
 * WXT の createIframeUi を使わない。'overlay' は wrapper に width:0 / height:0 を
 * 付けて iframe を 0×0 に潰し、'modal' でも wrapper の div が 1 つ増える。
 * content script がページに作る DOM は iframe 1 つだけにする（tech-stack.md §2）。
 */
function createPaletteFrame(src: string, extensionOrigin: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.dataset.backlogPalette = '';
  /*
   * クロスオリジンの iframe でクリップボードに書くには、埋め込む側が
   * Permissions Policy で許可する必要がある。コピーコマンドの前提。
   * 許可先を拡張の origin で名指しする。既定の 'src' は src 属性の origin を指すが、
   * use_dynamic_url の src は毎回変わる GUID の origin で、読み込まれた文書の origin
   * （chrome-extension://<id>）と一致せず、許可が届かない
   */
  iframe.allow = `clipboard-write ${extensionOrigin}`;
  iframe.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    // iframe には既定サイズ 300×150 が効くため、inset:0 だけでは引き伸ばされない
    'width:100%',
    'height:100%',
    'border:0',
    'z-index:2147483647',
    'color-scheme:normal',
  ].join(';');
  return iframe;
}

const ISSUE_PATH = /^\/view\/([A-Z][A-Z0-9_]*-\d+)/u;

function readPageContext(): PageContext {
  const { origin, pathname } = window.location;
  const issueKey = ISSUE_PATH.exec(pathname)?.[1];
  return {
    origin,
    pathname,
    spaceKey: spaceKeyOf(origin),
    projectKey: issueKey?.slice(0, issueKey.lastIndexOf('-')),
    issueKey,
  };
}

/** Backlog 本体のダークモードは `.dark-mode body` で変数を再定義する（backlog-facts.md §7） */
function readPageTheme() {
  const style = getComputedStyle(document.body);
  const scheme = document.querySelector('.dark-mode body') === null ? 'light' : 'dark';
  return readBacklogTheme((name) => style.getPropertyValue(name), scheme);
}

type PaletteFrame = { show: () => void; hide: () => void; syncTheme: () => void };

function createPaletteFrameControl(
  iframe: HTMLIFrameElement,
  extensionOrigin: string,
): PaletteFrame {
  const send = (message: ToIframe) => {
    iframe.contentWindow?.postMessage(message, extensionOrigin);
  };
  const syncTheme = () => send({ t: 'theme', theme: readPageTheme() });
  return {
    syncTheme,
    show: () => {
      /*
       * 読み込み時と遷移時にも送っているが、開く直前にも読み直す。Backlog は SPA で、
       * body のテーマクラスが wxt:locationchange より後に付け替わることがある
       */
      syncTheme();
      iframe.style.display = 'block';
      /*
       * 親からも iframe 要素にフォーカスを移す。iframe の中で input.focus() を
       * 呼ぶだけでは、ページ側にフォーカスされた要素が残っているときに
       * トップレベルのフォーカスが移らないことがある。
       */
      iframe.focus();
      send({ t: 'open', ctx: readPageContext() });
    },
    hide: () => {
      iframe.style.display = 'none';
      // 隠すだけでなく iframe にも伝える。伝えないと iframe は開いた状態を保持したままになる
      send({ t: 'close' });
    },
  };
}

type PaletteHost = { open: () => void; toggle: () => void; close: () => void };

function createPaletteHost(
  ctx: ContentScriptContext,
  iframe: HTMLIFrameElement,
  frame: PaletteFrame,
): PaletteHost {
  let isOpen = false;
  let isLoaded = false;
  let hasPendingOpen = false;

  const open = () => {
    isOpen = true;
    // 先行注入なので初回 ⌘K が load より先に来ることがある。読み込み完了後に開く
    if (!isLoaded) {
      hasPendingOpen = true;
      return;
    }
    frame.show();
  };

  const close = () => {
    isOpen = false;
    hasPendingOpen = false;
    frame.hide();
  };

  ctx.addEventListener(iframe, 'load', () => {
    isLoaded = true;
    // 開いてから送ると、表示された最初のフレームが既定の配色になる（D-57）
    frame.syncTheme();
    if (!hasPendingOpen) return;
    hasPendingOpen = false;
    frame.show();
  });

  return {
    open,
    toggle: () => {
      if (isOpen) {
        close();
      } else {
        open();
      }
    },
    close,
  };
}

/**
 * 検索状態の共有 URL を開いたらパレットを開く（palette.md §7.6）。何を復元するかは
 * iframe 側が自分で読んだタブ URL から決めるので、ここはフラグメントの有無だけを見る
 */
function openOnSharedSearch(ctx: ContentScriptContext, host: PaletteHost) {
  const run = () => {
    if (window.location.hash.includes(`${SHARE_FRAGMENT_KEY}=`)) host.open();
  };
  run();
  ctx.addEventListener(window, 'wxt:locationchange', run);
}

/** URL と document.title だけから表示キャッシュに記録する。本文・コメントは読まない（surfaces.md §3） */
function recordCurrentPage() {
  const page = readVisitedPage(window.location.href);
  if (page === undefined) return;
  const title = summaryFromTitle(document.title);
  void recordVisit({ ...page, ...(title === undefined ? {} : { title }), visitedAt: Date.now() });
}

export default defineContentScript({
  matches: [...BACKLOG_SPACE_MATCHES],
  excludeMatches: [...NOT_A_SPACE_MATCHES],

  main(ctx) {
    const extensionOrigin = new URL(browser.runtime.getURL('/')).origin;
    // 初回 ⌘K で読み込みを待たせないため、非表示のまま先に注入する（palette.md §3）
    const iframe = createPaletteFrame(browser.runtime.getURL('/palette.html'), extensionOrigin);
    /*
     * body ではなく documentElement に付ける。body に transform や filter が
     * 掛かると position:fixed の基準が body になり、全面を覆えなくなる。
     */
    document.documentElement.append(iframe);
    ctx.onInvalidated(() => iframe.remove());

    const frame = createPaletteFrameControl(iframe, extensionOrigin);
    const host = createPaletteHost(ctx, iframe, frame);
    ctx.addEventListener(window, 'wxt:locationchange', frame.syncTheme);

    /*
     * キャプチャ段階で受ける。Backlog 本体がバブリングで ⌘K を使っていても
     * 先に止められる。commands は使わない（D-10）。
     */
    ctx.addEventListener(
      window,
      'keydown',
      (event) => {
        if (!isPaletteHotkey(event, navigator.platform)) return;
        // 変換中は捕捉しない（I5）。テキスト入力にフォーカスがあるときも捕捉しない（D-21）
        if (event.isComposing || isTextEntryTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        host.toggle();
      },
      { capture: true },
    );

    recordCurrentPage();
    ctx.addEventListener(window, 'wxt:locationchange', recordCurrentPage);

    setupConnectPage(ctx, browser.runtime.getURL('/connect.html'), extensionOrigin);
    openOnSharedSearch(ctx, host);

    ctx.addEventListener(window, 'message', (event) => {
      // 送信元が自分の iframe であることと、拡張の origin であることの両方を確認する
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== extensionOrigin) return;
      if (!isFromIframe(event.data) || event.data.t !== 'close') return;
      host.close();
    });
  },
});
