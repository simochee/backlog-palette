/**
 * content script と パレット iframe の間の唯一の通信路。
 *
 * 受け付けるのは open / close の 2 種だけ（実装プラン §2.3）。
 *
 * 設計時は resize も含む 3 種だったが、パレットをビューポート全面の
 * オーバーレイ iframe にしたため高さ同期が不要になった。メッセージを
 * 足すときは、セキュリティ設計の変更として起票する。
 */

/** ページ由来のヒント。スコープの初期値とランキングにのみ使い、認証の選択には使わない */
export type PageContext = {
  origin: string;
  spaceKey?: string;
  projectKey?: string;
  issueKey?: string;
};

export type ToIframe = { t: 'open'; ctx: PageContext } | { t: 'close' };

export type FromIframe = { t: 'close' };

/**
 * Backlog のスペースは必ずサブドメインを持つ。
 *
 * ヌーラボのマーケティングサイト（backlog.com / www.backlog.jp など）は
 * スペースではないので除く。Chrome の match pattern `*.backlog.com` は
 * apex ドメインにもマッチするため、manifest の excludeMatches と対で
 * 意味を保たないと「注入はされるがメッセージは拒否される」ずれが生まれる。
 *
 * backlogtool.com は旧ドメインだが現役（docs/backlog-facts.md）。
 * 含めないと旧ドメインのスペースでパレットが黙って動かない。
 */
const BACKLOG_SPACE =
  /^https:\/\/(?!www\.|support-(?:ja|en)\.)[a-z0-9-]+\.(?:backlog\.(?:jp|com)|backlogtool\.com)$/;

/**
 * 登録済みスペースのオリジンかどうか。
 *
 * Enterprise のカスタムドメインは静的に判定できないため、登録済みホストの
 * 一覧を引数で受ける。ここでワイルドカードを許すと、任意のページが
 * パレットへ open を送れるようになる。
 */
export function isTrustedPageOrigin(origin: string, customHosts: readonly string[] = []): boolean {
  if (BACKLOG_SPACE.test(origin)) return true;
  return customHosts.some((host) => origin === `https://${host}`);
}

export function isToIframe(value: unknown): value is ToIframe {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { t?: unknown }).t;
  return t === 'open' || t === 'close';
}

export function isFromIframe(value: unknown): value is FromIframe {
  if (typeof value !== 'object' || value === null) return false;
  return (value as { t?: unknown }).t === 'close';
}
