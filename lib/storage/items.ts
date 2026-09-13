import type { PersistedClient } from '@tanstack/query-persist-client-core';

import { storage } from '#imports';
import type { SpaceRateRecord } from '@/lib/backlog/rateLimit';
import type { ConnectedSpace } from '@/lib/connect/connectSpace';

export type VisitedKind = 'issue' | 'project' | 'wiki' | 'document';

/**
 * 表示キャッシュの 1 件。content script が URL と document.title から記録する（surfaces.md §3）。
 * 本文・コメントは読まない。title は形式が合ったときだけ入る。
 */
export type DisplayCacheEntry = {
  url: string;
  kind: VisitedKind;
  /** スペースの識別子はホスト名（D-32）。`demo.backlog.jp` */
  spaceHost: string;
  projectKey: string;
  /** 課題キー・Wiki の名前や ID・ドキュメント ID。プロジェクトのページでは無い */
  key?: string;
  title?: string;
  /** 課題の再検証（D-14）で分かった今の状態。ページから読まず、API の応答だけが入れる */
  status?: { id: number; name: string };
  assignee?: string;
  visitedAt: number;
};

type DisplayCacheEntryV1 = Omit<DisplayCacheEntry, 'status' | 'assignee'>;

/**
 * 新しい訪問が先頭。同じ URL は 1 件にまとめる。
 * v2 は status と assignee を足しただけで、v1 の値はそのまま読める
 */
export const displayCache = storage.defineItem<DisplayCacheEntry[]>('local:displayCache', {
  fallback: [],
  version: 2,
  migrations: { 2: (entries: DisplayCacheEntryV1[]): DisplayCacheEntry[] => entries },
});

/**
 * スペースごとの API キー。キーは接続先のホスト（`demo.backlog.jp`）。スペースキーは
 * .jp と .com で重なりうるうえ、Enterprise のカスタムドメインには無い。
 *
 * 拡張ページと Service Worker だけが読む（I7）。DB のコレクションにも live query にも
 * 載せない（tech-stack.md §3.2）。content script・props・fixtures・ログに出さない。
 */
export const apiKeys = storage.defineItem<Record<string, string>>('local:apiKeys', {
  fallback: {},
  version: 1,
});

/** レート枠の共有状態。ホストごと。形は lib/backlog/rateLimit.ts の SpaceRateRecord */
export const rateLimits = storage.defineItem<Record<string, SpaceRateRecord>>('local:rateLimits', {
  fallback: {},
  version: 1,
});

/**
 * 接続済みスペースの一覧。host が識別子で、同じ host は 1 件。鍵は含まない（apiKeys が持つ）。
 * 配列なのは TanStack DB のコレクション（lib/storage/collection.ts、M2）が T[] の item を前提にするため。
 */
export const spaces = storage.defineItem<ConnectedSpace[]>('local:spaces', {
  fallback: [],
  version: 1,
});

/**
 * TanStack Query のキャッシュ（マスタ・担当課題）。パレット・サイドパネル・設定画面が
 * 同じキャッシュを見るための persister の置き場所。検索の結果は載せない（lib/backlog/queryClient.ts）。
 */
export const queryCache = storage.defineItem<PersistedClient | null>('local:queryCache', {
  fallback: null,
  version: 1,
});
