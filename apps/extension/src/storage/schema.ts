import { storage } from 'wxt/utils/storage';
import type { KeywordTarget } from './types.ts';

/**
 * ローカルに置くものの一覧（実装プラン §9）。
 *
 * 認証情報だけは扱いを分ける。アクセストークンは session に置き、
 * ブラウザを閉じたら消える。リフレッシュトークンと API キーは local に
 * 残すが、参照は Service Worker からのみ（§2.3）。
 */

export type SpaceConnection = {
  spaceKey: string;
  host: string;
  method: 'oauth' | 'apiKey';
  displayName: string;
  lastSyncedAt?: number;
  state: 'connected' | 'needsReconnect';
};

export type DisplayCacheEntry = {
  /** 課題キー / Wiki 名 / プロジェクト名など、行の主テキスト */
  title: string;
  projectName?: string;
  kind: 'issue' | 'wiki' | 'document' | 'project';
  lastSeenAt: number;
};

export type Settings = {
  /** 学習をオフにすると frecency とクエリ辞書を並びに使わない */
  learningEnabled: boolean;
  /** 課題キー形式を検出したら常に先頭固定にする */
  issueKeyFirst: boolean;
  defaultSurface: 'modal' | 'panel';
  colorScheme: 'system' | 'light' | 'dark';
  keywordTarget: KeywordTarget;
};

export const DEFAULT_SETTINGS: Settings = {
  learningEnabled: true,
  issueKeyFirst: true,
  defaultSurface: 'modal',
  colorScheme: 'system',
  /*
   * 既定は最も保守的な 'subject'。keyword が本文にも一致するかは未確認
   * （実装プラン §18-1）で、確認できていない範囲を既定にすると
   * 「検索したのに出てこない」を既定の体験にしてしまう。
   */
  keywordTarget: 'subject',
};

export const spacesItem = storage.defineItem<SpaceConnection[]>('local:spaces', {
  fallback: [],
  version: 1,
});

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

/** キーは `{spaceKey}/{識別子}`。スペースをまたいだ同名を衝突させない */
export const displayCacheItem = storage.defineItem<Record<string, DisplayCacheEntry>>(
  'local:displayCache',
  { fallback: {}, version: 1 },
);

export const searchHistoryItem = storage.defineItem<string[]>('local:searchHistory', {
  fallback: [],
  version: 1,
});
