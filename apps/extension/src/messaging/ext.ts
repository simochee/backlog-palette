import type { IndexEntry, SearchState } from '@backlog-palette/core';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { RowView } from './rowView.ts';
import type { PageContext } from './window.ts';

/**
 * パレット UI と Service Worker の間の契約（実装プラン §6.4）。
 *
 * UI は API も認証情報も触らない。ここに書かれた操作だけが UI からできること。
 */

export type Surface = 'modal' | 'panel';

export type PaletteSection = {
  id: string;
  label?: string;
  meta?: string;
  rows: readonly (RowView & { id: string })[];
};

export type BootstrapState = {
  /** 空状態のセクション。API 応答を待たずに描ける内容だけを含む（§5.3） */
  sections: readonly PaletteSection[];
  /**
   * 打鍵ごとの一致に使う索引。開いた時点で丸ごと渡す。
   *
   * 打鍵ごとに Service Worker と往復すると、応答より先に Enter を押せてしまい
   * 1 打鍵前の候補で遷移する。往復を無くせばこの競合自体が消え、
   * 1 打鍵 16ms の予算（§14）も守りやすい。
   */
  index: readonly IndexEntry[];
  /** 行 id → 起きること */
  actions: Record<string, RowAction>;
  connectedSpaces: readonly { spaceKey: string; displayName: string }[];
  /** 学習がオフなら並びに frecency を使わない */
  learningEnabled: boolean;
};

export type NavigateRequest = {
  /** 遷移先。SW が組み立てた URL のみを受け付ける */
  url: string;
  target: 'currentTab' | 'newTab';
};

export type VisitRecord = {
  spaceKey: string;
  id: string;
  title: string;
  projectName?: string;
  kind: 'issue' | 'wiki' | 'document' | 'project';
};

/**
 * 行を選んだときに起きること。
 *
 * UI は「何が起きるか」を知らずに id を返すだけ。実際の遷移とコピーは
 * Service Worker が行う（§2.3）。
 */
export type RowAction =
  | { kind: 'navigate'; url: string; target?: 'currentTab' | 'newTab' }
  | { kind: 'copy'; text: string; toast: string };

export type ConnectRequest =
  | { method: 'oauth'; host: string }
  | { method: 'apiKey'; host: string; apiKey: string };

/**
 * 接続の結果。**認証情報そのものは絶対に載せない**（§2.3）。
 * UI が知ってよいのは「繋がったか」と「繋がらなかった理由」だけ。
 */
export type ConnectOutcome =
  | { ok: true; spaceKey: string; displayName: string }
  | { ok: false; reason: string; message: string };

type ExtProtocol = {
  /** パレットを開いたときに 1 回だけ。空状態と索引をまとめて渡す */
  getBootstrap(request: { surface: Surface; ctx: PageContext }): BootstrapState;
  navigate(request: NavigateRequest): void;
  /** 行を選んだときの実行。UI は何が起きるかを知らずに渡す */
  runRowAction(action: RowAction): void;
  /** スペースを接続する。認証情報は Service Worker から出さない */
  connectSpace(request: ConnectRequest): ConnectOutcome;
  disconnectSpace(spaceKey: string): void;
  /** 検索を始める。結果は searchChunk で流れてくる */
  startSearch(request: { requestId: string; state: SearchState }): void;
  /** 打鍵し直したときに前の検索を止める */
  cancelSearch(requestId: string): void;
  /** content script が閲覧を記録する。API は呼ばない（§9 の表示キャッシュ） */
  recordVisit(record: VisitRecord): void;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ExtProtocol>();

/**
 * Service Worker から拡張ページへ流す通知。
 *
 * 検索は要求 / 応答にしない。スペースごとに返ってきた順に描くのが
 * サイドパネルの前提（実装プラン §7.4）で、全部揃うのを待つと
 * 「1 スペースが遅いと何も出ない」になる。
 */
type ExtEvents = {
  searchChunk(chunk: { requestId: string } & SearchChunkPayload): void;
  connectionChanged(change: { spaceKey: string; state: 'connected' | 'needsReconnect' }): void;
};

/** services/search の SearchChunk と構造を合わせる（型は extension 内で閉じる） */
export type SearchChunkPayload =
  | { spaceKey: string; state: 'loading' }
  | { spaceKey: string; state: 'done'; rows: readonly SearchResultRow[]; total: number }
  | {
      spaceKey: string;
      state: 'error';
      error: { kind: 'unauthorized' | 'rateLimited' | 'offline' | 'unknown'; retryAt?: number };
    };

export type SearchResultRow = RowView & {
  id: string;
  url: string;
  updatedAt: number;
  spaceKey: string;
  kind: 'issue' | 'wiki' | 'document';
  body?: string;
};

export const { sendMessage: sendEvent, onMessage: onEvent } = defineExtensionMessaging<ExtEvents>();
