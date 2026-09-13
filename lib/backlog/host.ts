/*
 * backlogtool.com は旧ドメインだが現役（docs/backlog-facts.md §4.1）。
 * 含めないと旧ドメインのスペースでパレットが黙って動かない。
 */
export const BACKLOG_SPACE_MATCHES = [
  'https://*.backlog.jp/*',
  'https://*.backlog.com/*',
  'https://*.backlogtool.com/*',
] as const;

/*
 * Chrome の match pattern `*.backlog.com` は apex と www にもマッチする。
 * どちらもマーケティングサイトでスペースではない（docs/backlog-facts.md §4.2）。
 * isBacklogSpaceOrigin と対で意味を保たないと「注入はされるがメッセージは
 * 拒否される」ずれが生まれる。
 */
export const NOT_A_SPACE_MATCHES = [
  'https://backlog.jp/*',
  'https://www.backlog.jp/*',
  'https://backlog.com/*',
  'https://www.backlog.com/*',
  'https://backlogtool.com/*',
  'https://www.backlogtool.com/*',
  'https://support-ja.backlog.com/*',
  'https://support-en.backlog.com/*',
] as const;

const SPACE_ORIGIN =
  /^https:\/\/(?!www\.|support-(?:ja|en)\.)([a-z0-9-]+)\.(?:backlog\.(?:jp|com)|backlogtool\.com)$/u;

/**
 * Enterprise のカスタムドメインは静的に判定できないため、登録済みホストを
 * 引数で受ける。ここでワイルドカードを許すと任意のページがパレットへ
 * open を送れるようになる（surfaces.md §8）。
 */
export function isBacklogSpaceOrigin(origin: string, customHosts: readonly string[] = []): boolean {
  if (SPACE_ORIGIN.test(origin)) return true;
  return customHosts.some((host) => origin === `https://${host}`);
}

/** origin からスペースキーを読む。スペースの origin でなければ undefined */
export function spaceKeyOf(origin: string): string | undefined {
  return SPACE_ORIGIN.exec(origin)?.[1];
}
