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

/** 静的な 3 ドメイン以外の origin を信じるかの判定。カスタムドメイン（surfaces.md §8）は storage を読むので非同期 */
export type TrustOrigin = (origin: string) => Promise<boolean>;

const noExtraTrust: TrustOrigin = () => Promise.resolve(false);

type Inbox = {
  accept: (origin: string, message: ToIframe) => void;
  subscribe: HostChannel['subscribe'];
  send: HostChannel['send'];
};

function createInbox(scope: Window): Inbox {
  const buffered: ToIframe[] = [];
  const outgoing: FromIframe[] = [];
  const handlers = new Set<(message: ToIframe) => void>();
  let parentOrigin: string | undefined;

  return {
    accept(origin, message) {
      // 返信先は「実際に送ってきた origin」。ページが名乗った値は使わない
      parentOrigin = origin;
      // origin の検証が済む前に iframe 側が送ろうとした返信（Esc の close など）をここで流す
      for (const pending of outgoing.splice(0)) scope.parent.postMessage(pending, origin);
      if (handlers.size === 0) {
        buffered.push(message);
        return;
      }
      for (const handler of handlers) handler(message);
    },
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

export function createHostChannel(
  scope: Window,
  extraTrust: TrustOrigin = noExtraTrust,
): HostChannel {
  const { accept, subscribe, send } = createInbox(scope);

  /*
   * 静的なスペースは同期で受ける。open を待たせると、その間に打たれた文字が入力欄に
   * 入った後で状態のリセットが届き、消える（palette.md §3）。非同期の判定はカスタム
   * ドメインだけ
   */
  const receive = (origin: string, message: ToIframe) => {
    if (isTrustedPageOrigin(origin)) {
      accept(origin, message);
      return;
    }
    const consider = async () => {
      if (await extraTrust(origin)) accept(origin, message);
    };
    void consider();
  };

  scope.addEventListener('message', (event: MessageEvent<unknown>) => {
    // 埋め込み元の window からで、かつ登録済みスペースの origin からのメッセージだけ処理する
    if (event.source !== scope.parent) return;
    if (isToIframe(event.data)) receive(event.origin, event.data);
  });

  return { subscribe, send };
}
