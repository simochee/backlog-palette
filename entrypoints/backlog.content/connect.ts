import type { ContentScriptContext } from '#imports';
import { isConnectRequest, isMemoField, KEY_MEMO } from '@/lib/connect/page';
import { isFromIframe, type ToIframe } from '@/lib/messaging/window';

export const CONNECT_FRAME_ATTRIBUTE = 'data-backlog-palette-connect';

function labelTextOf(input: HTMLInputElement): string | undefined {
  return input.labels?.[0]?.textContent ?? undefined;
}

function findMemoInput(root: ParentNode): HTMLInputElement | undefined {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
  return [...inputs].find((input) =>
    isMemoField({
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      label: labelTextOf(input),
    }),
  );
}

function fillMemo(input: HTMLInputElement) {
  // 人が打ち始めた値は上書きしない
  if (input.value !== '') return;
  input.value = KEY_MEMO;
  // value の代入だけではページ側のフレームワークが追従せず、登録時に空で送られることがある
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * メモ欄が後から描かれても効くように、見つかるまで DOM の変化を見る（mvp は一度きりの
 * 探索で失敗した）。時間で諦めず、ページを離れたときに片付ける。
 */
function fillMemoWhenRendered(ctx: ContentScriptContext) {
  const found = findMemoInput(document);
  if (found !== undefined) {
    fillMemo(found);
    return;
  }
  const observer = new MutationObserver(() => {
    const input = findMemoInput(document);
    if (input === undefined) return;
    observer.disconnect();
    fillMemo(input);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ctx.onInvalidated(() => observer.disconnect());
}

/** 画面下部中央の横長。ページ操作を塞がないよう、バーの大きさだけを覆う */
function createConnectFrame(src: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.setAttribute(CONNECT_FRAME_ATTRIBUTE, '');
  iframe.style.cssText = [
    'position:fixed',
    'bottom:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'width:min(640px, calc(100vw - 32px))',
    'height:96px',
    'border:0',
    'background:transparent',
    'color-scheme:normal',
    'z-index:2147483646',
  ].join(';');
  return iframe;
}

function showConnectBar(ctx: ContentScriptContext, src: string, extensionOrigin: string) {
  if (document.querySelector(`iframe[${CONNECT_FRAME_ATTRIBUTE}]`) !== null) return;
  const iframe = createConnectFrame(src);
  document.documentElement.append(iframe);
  ctx.onInvalidated(() => iframe.remove());

  ctx.addEventListener(iframe, 'load', () => {
    // 返信先の origin を iframe に教える。鍵の選択には使われない（I7）
    const message: ToIframe = { t: 'open', ctx: { origin: window.location.origin } };
    iframe.contentWindow?.postMessage(message, extensionOrigin);
    iframe.focus();
  });

  ctx.addEventListener(window, 'message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (event.origin !== extensionOrigin) return;
    if (!isFromIframe(event.data)) return;
    iframe.remove();
  });
}

/** API キー発行ページに #bp-connect で来たときだけ、メモ欄を埋めて貼り付けバーを出す（surfaces.md §1.1） */
export function setupConnectPage(ctx: ContentScriptContext, src: string, extensionOrigin: string) {
  const run = () => {
    if (!isConnectRequest(window.location.href)) return;
    fillMemoWhenRendered(ctx);
    showConnectBar(ctx, src, extensionOrigin);
  };
  run();
  ctx.addEventListener(window, 'wxt:locationchange', run);
}
