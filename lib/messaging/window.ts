import { isBacklogSpaceOrigin } from '@/lib/backlog/host';

/**
 * content script とパレット iframe の間の唯一の通信路。
 *
 * 受け付けるのは open / close の 2 種だけ（tech-stack.md §2）。
 * 足すときはセキュリティ設計の変更として decisions.md に起票する。
 */

/** ページ由来のヒント。スコープの初期値と並びにだけ使い、鍵やスペースの選択には使わない（I7） */
export type PageContext = {
  origin: string;
  spaceKey?: string;
  projectKey?: string;
  issueKey?: string;
};

export type ToIframe = { t: 'open'; ctx: PageContext } | { t: 'close' };

export type FromIframe = { t: 'close' };

/** 登録済みスペースの origin かどうか。iframe 側が受けた open / close の送り主を検証する */
export function isTrustedPageOrigin(origin: string, customHosts: readonly string[] = []): boolean {
  return isBacklogSpaceOrigin(origin, customHosts);
}

function readField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Reflect.get(value, key);
}

function isPageContext(value: unknown): value is PageContext {
  return typeof readField(value, 'origin') === 'string';
}

export function isToIframe(value: unknown): value is ToIframe {
  const t = readField(value, 't');
  if (t === 'close') return true;
  return t === 'open' && isPageContext(readField(value, 'ctx'));
}

export function isFromIframe(value: unknown): value is FromIframe {
  return readField(value, 't') === 'close';
}
