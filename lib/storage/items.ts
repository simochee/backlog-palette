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
  spaceKey: string;
  projectKey: string;
  /** 課題キー・Wiki の名前や ID・ドキュメント ID。プロジェクトのページでは無い */
  key?: string;
  title?: string;
  visitedAt: number;
};

/** 新しい訪問が先頭。同じ URL は 1 件にまとめる */
export const displayCache = storage.defineItem<DisplayCacheEntry[]>('local:displayCache', {
  fallback: [],
  version: 1,
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
