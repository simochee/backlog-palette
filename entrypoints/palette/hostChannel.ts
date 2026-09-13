import {
  type FromIframe,
  isToIframe,
  isTrustedPageOrigin,
  type ToIframe,
} from '@/lib/messaging/window';

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

export function createHostChannel(scope: Window): HostChannel {
  const buffered: ToIframe[] = [];
  const handlers = new Set<(message: ToIframe) => void>();
  let parentOrigin: string | undefined;

  scope.addEventListener('message', (event: MessageEvent<unknown>) => {
    // 埋め込み元の window からで、かつ登録済みスペースの origin からのメッセージだけ処理する
    if (event.source !== scope.parent) return;
    if (!isTrustedPageOrigin(event.origin)) return;
    if (!isToIframe(event.data)) return;

    // 返信先は「実際に送ってきた origin」。ページが名乗った値は使わない
    parentOrigin = event.origin;

    if (handlers.size === 0) {
      buffered.push(event.data);
      return;
    }
    for (const handler of handlers) handler(event.data);
  });

  return {
    subscribe(next) {
      handlers.add(next);
      for (const message of buffered.splice(0)) next(message);
      return () => {
        handlers.delete(next);
      };
    },

    send(message) {
      // targetOrigin に '*' を使わない。open を受ける前は返信先が無いので送らない
      if (parentOrigin === undefined) return;
      scope.parent.postMessage(message, parentOrigin);
    },
  };
}

export const hostChannel = createHostChannel(window);
