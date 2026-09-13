import { browser, defineContentScript } from '#imports';
import { BACKLOG_SPACE_MATCHES, NOT_A_SPACE_MATCHES } from '@/lib/backlog/host';

/*
 * WXT の createIframeUi を使わない。'overlay' は wrapper に width:0 / height:0 を
 * 付けて iframe を 0×0 に潰し、'modal' でも wrapper の div が 1 つ増える。
 * content script がページに作る DOM は iframe 1 つだけにする（tech-stack.md §2）。
 */
function createPaletteFrame(src: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.dataset.backlogPalette = '';
  /*
   * クロスオリジンの iframe でクリップボードに書くには、埋め込む側が
   * Permissions Policy で許可する必要がある。コピーコマンドの前提。
   */
  iframe.allow = 'clipboard-write';
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

export default defineContentScript({
  matches: [...BACKLOG_SPACE_MATCHES],
  excludeMatches: [...NOT_A_SPACE_MATCHES],

  main(ctx) {
    // 初回 ⌘K で読み込みを待たせないため、非表示のまま先に注入する（palette.md §3）
    const iframe = createPaletteFrame(browser.runtime.getURL('/palette.html'));
    /*
     * body ではなく documentElement に付ける。body に transform や filter が
     * 掛かると position:fixed の基準が body になり、全面を覆えなくなる。
     */
    document.documentElement.append(iframe);
    ctx.onInvalidated(() => iframe.remove());
  },
});
