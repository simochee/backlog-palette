import { defineExtensionMessaging } from '@webext-core/messaging';
import type { RowView } from './rowView.ts';

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

type ExtProtocol = {
  getBootstrap(surface: Surface): BootstrapState;
  navigate(request: NavigateRequest): void;
  /** content script が閲覧を記録する。API は呼ばない（§9 の表示キャッシュ） */
  recordVisit(record: VisitRecord): void;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ExtProtocol>();
