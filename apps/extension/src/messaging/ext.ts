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

export type LocalQuery = {
  input: string;
  ctx: PageContext;
};

export type LocalResult = {
  sections: readonly PaletteSection[];
  /** 行 id → 遷移先。URL を持たない行（コマンドなど）は含まない */
  urls: Record<string, string>;
};

type ExtProtocol = {
  getBootstrap(surface: Surface): BootstrapState;
  /** 打鍵ごとに呼ばれる。ローカル索引だけで応答し、API は叩かない（§7.2） */
  localCandidates(query: LocalQuery): LocalResult;
  navigate(request: NavigateRequest): void;
  /** content script が閲覧を記録する。API は呼ばない（§9 の表示キャッシュ） */
  recordVisit(record: VisitRecord): void;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ExtProtocol>();
