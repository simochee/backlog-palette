import { type FromIframe, isToIframe, isTrustedPageOrigin, type ToIframe } from './window.ts';

/**
 * パレット iframe 側から見た、埋め込み元ページとの通信路。
 *
 * リスナーはモジュール評価時に張る。React のマウントまで待つと、その間に
 * 届いた open を取りこぼし、content script は送った・iframe は受けていない
 * という形で「⌘K を押しても何も起きない」状態になる。
 * マウント前のメッセージはバッファし、subscribe 時にまとめて流す。
 */
export type HostChannel = {
  subscribe: (handler: (message: ToIframe) => void) => () => void;
  send: (message: FromIframe) => void;
};

type MessageScope = {
  addEventListener: (type: 'message', listener: (event: MessageEvent<unknown>) => void) => void;
  parent: { postMessage: (message: unknown, targetOrigin: string) => void };
};

export function createHostChannel(scope: MessageScope): HostChannel {
  const buffered: ToIframe[] = [];
  let handler: ((message: ToIframe) => void) | undefined;
  let parentOrigin: string | undefined;

  scope.addEventListener('message', (event) => {
    // 登録済みスペースのオリジンからのメッセージだけ処理する（§2.3）
    if (!isTrustedPageOrigin(event.origin)) return;
    if (!isToIframe(event.data)) return;

    // 返信先は「実際に送ってきたオリジン」。ページが名乗った値は使わない
    parentOrigin = event.origin;

    if (handler === undefined) {
      buffered.push(event.data);
      return;
    }
    handler(event.data);
  });

  return {
    subscribe(next) {
      handler = next;
      for (const message of buffered.splice(0)) next(message);
      return () => {
        handler = undefined;
      };
    },

    send(message) {
      // targetOrigin に '*' を使わない
      if (parentOrigin === undefined) return;
      scope.parent.postMessage(message, parentOrigin);
    },
  };
}
