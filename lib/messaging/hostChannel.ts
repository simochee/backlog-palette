import { type FromIframe, isToIframe, isTrustedPageOrigin, type ToIframe } from './window';

/**
 * 拡張の iframe（パレット・貼り付けバー）側から見た、埋め込み元ページとの通信路。
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

/** origin を信じるかの判定。カスタムドメイン（surfaces.md §8）は storage を読むので非同期 */
export type TrustOrigin = (origin: string) => Promise<boolean>;

const staticTrust: TrustOrigin = (origin) => Promise.resolve(isTrustedPageOrigin(origin));

export function createHostChannel(scope: Window, trust: TrustOrigin = staticTrust): HostChannel {
  const buffered: ToIframe[] = [];
  const outgoing: FromIframe[] = [];
  const handlers = new Set<(message: ToIframe) => void>();
  let parentOrigin: string | undefined;

  const accept = (origin: string, message: ToIframe) => {
    // 返信先は「実際に送ってきた origin」。ページが名乗った値は使わない
    parentOrigin = origin;
    // origin の検証が済む前に iframe 側が送ろうとした返信（Esc の close など）をここで流す
    for (const pending of outgoing.splice(0)) scope.parent.postMessage(pending, origin);
    if (handlers.size === 0) {
      buffered.push(message);
      return;
    }
    for (const handler of handlers) handler(message);
  };

  scope.addEventListener('message', (event: MessageEvent<unknown>) => {
    // 埋め込み元の window からで、かつ登録済みスペースの origin からのメッセージだけ処理する
    if (event.source !== scope.parent) return;
    if (!isToIframe(event.data)) return;
    const { origin } = event;
    const message = event.data;
    const consider = async () => {
      if (await trust(origin)) accept(origin, message);
    };
    void consider();
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
      // targetOrigin に '*' を使わない。open を受けて返信先が分かるまで待つ
      if (parentOrigin === undefined) {
        outgoing.push(message);
        return;
      }
      scope.parent.postMessage(message, parentOrigin);
    },
  };
}
