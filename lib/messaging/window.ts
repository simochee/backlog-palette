import { isBacklogSpaceOrigin } from '@/lib/backlog/host';
import type { BacklogTheme } from '@/lib/theme/backlogTheme';

/**
 * content script とパレット iframe の間の唯一の通信路。
 *
 * ページへは open / close とプロジェクトテーマの theme（D-57）、ページからは close と、
 * 貼り付けバーだけが送る connected（D-56）。
 * 足すときはセキュリティ設計の変更として decisions.md に起票する。
 */

/** ページ由来のヒント。スコープの初期値と並びにだけ使い、鍵やスペースの選択には使わない（I7） */
export type PageContext = {
  origin: string;
  /** 用意済みの文脈が今のページのものかを見分けるためだけに使う。スコープの決定には使わない */
  pathname?: string;
  spaceKey?: string;
  projectKey?: string;
  issueKey?: string;
};

/** theme の中身は受け手が parseBacklogTheme で検証し直す。ここでは形だけを見る */
export type ToIframe =
  | { t: 'open'; ctx: PageContext }
  | { t: 'close' }
  | { t: 'theme'; theme: BacklogTheme | undefined };

export type FromIframe = { t: 'close' } | { t: 'connected' };

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
  if (t === 'close' || t === 'theme') return true;
  return t === 'open' && isPageContext(readField(value, 'ctx'));
}

export function isFromIframe(value: unknown): value is FromIframe {
  const t = readField(value, 't');
  return t === 'close' || t === 'connected';
}
