import { z } from 'zod';

import { searchScopeSchema } from '@/lib/share/schema';

import { createStorageCollection, type StorageItemLike } from './collection';
import type {
  ActivityRecord,
  QueryDictRecord,
  SearchHistoryRecord,
  TransitionRecord,
} from './palette-items';

/**
 * コレクションの定義。item は引数で受け、#imports を知らない。配線（既定の item を渡す）は
 * collections.ts が行い、テストは偽の item を渡す
 */

/** 表示キャッシュの 1 件。形は lib/storage/items.ts の DisplayCacheEntry（version 2）と同じ（URL が単位） */
export const displayCacheSchema = z.object({
  url: z.url(),
  kind: z.enum(['issue', 'project', 'wiki', 'document']),
  /** スペースの識別子はホスト名（D-32） */
  spaceHost: z.string().min(1),
  projectKey: z.string().min(1),
  key: z.string().optional(),
  title: z.string().optional(),
  /** 課題の再検証（D-14）で分かった今の状態。version 2 で足された */
  status: z.object({ id: z.number().int(), name: z.string() }).optional(),
  assignee: z.string().optional(),
  visitedAt: z.number(),
});

export const activitySchema = z.object({ entityId: z.string().min(1), at: z.number() });

export const transitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  at: z.number(),
});

export const searchHistorySchema = z.object({
  query: z.string(),
  scope: searchScopeSchema,
  at: z.number(),
});

export const queryDictSchema = z.object({
  query: z.string(),
  entityId: z.string().min(1),
  count: z.number().int().nonnegative(),
  at: z.number(),
});

/**
 * 接続済みスペース。item（local:spaces）は M4 の items.ts が所有し、形は ConnectedSpace と同じ。
 * host が識別子（D-32）。鍵は持たない
 */
export const spaceSchema = z.object({
  host: z.string().min(1),
  name: z.string(),
  spaceKey: z.string().min(1),
  icon: z.string().optional(),
  projectCount: z.number().int().nonnegative(),
  connectedAt: z.number(),
  needsReconnect: z.boolean().optional(),
});

export type ConnectedSpaceRow = z.infer<typeof spaceSchema>;

export type DisplayCacheRow = z.infer<typeof displayCacheSchema>;

/** 表示キャッシュは URL が 1 件の単位（M3 の pushVisit と同じ） */
export const displayCacheCollection = (item: StorageItemLike<DisplayCacheRow[]>) =>
  createStorageCollection({
    id: 'displayCache',
    item,
    getKey: (row) => row.url,
    schema: displayCacheSchema,
  });

/** 行動ログは追記だけなので、対象と時刻の組を鍵にする */
export const activityCollection = (item: StorageItemLike<ActivityRecord[]>) =>
  createStorageCollection({
    id: 'activity',
    item,
    getKey: (row) => `${row.entityId}@${row.at}`,
    schema: activitySchema,
  });

export const transitionsCollection = (item: StorageItemLike<TransitionRecord[]>) =>
  createStorageCollection({
    id: 'transitions',
    item,
    getKey: (row) => `${row.from}>${row.to}@${row.at}`,
    schema: transitionSchema,
  });

/** 同じ語・同じスコープは 1 件 */
export const searchHistoryCollection = (item: StorageItemLike<SearchHistoryRecord[]>) =>
  createStorageCollection({
    id: 'searchHistory',
    item,
    getKey: (row) => `${JSON.stringify(row.scope)}:${row.query}`,
    schema: searchHistorySchema,
  });

export const queryDictCollection = (item: StorageItemLike<QueryDictRecord[]>) =>
  createStorageCollection({
    id: 'queryDict',
    item,
    getKey: (row) => `${row.query}>${row.entityId}`,
    schema: queryDictSchema,
  });

export const spacesCollection = (item: StorageItemLike<ConnectedSpaceRow[]>) =>
  createStorageCollection({ id: 'spaces', item, getKey: (row) => row.host, schema: spaceSchema });
