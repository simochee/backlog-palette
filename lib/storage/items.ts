import { storage } from '#imports';

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
