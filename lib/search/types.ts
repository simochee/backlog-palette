import type { Badge } from '@/components/types';
import type { Scope } from '@/lib/stack/types';

/** 検索の単位。スペース横断はしない（D-20）ので、進捗も合流も種別ごと */
export const searchKinds = ['issue', 'wiki', 'document'] as const;
export type SearchKind = (typeof searchKinds)[number];

/**
 * 行に閉じて出す障害（§7.5・I6）。unauthorized / rateLimited / offline は専用の行や補足を持つ。
 * failed（5xx など）は種別が届かなかったものとして扱い、他の種別と 0 件時の提案行に任せる
 */
export type SearchError =
  | { kind: 'unauthorized' }
  | { kind: 'rateLimited'; retryAfterSeconds: number }
  | { kind: 'offline' }
  | { kind: 'failed' };

export type KindProgress =
  | { state: 'loading' }
  | { state: 'ready'; count: number }
  | { state: 'error'; error: SearchError };

export type ResultRow = {
  kind: SearchKind;
  id: string;
  key?: string;
  title: string;
  projectName: string;
  assignee?: string;
  updatedBy?: string;
  status?: Badge;
  type?: Badge;
  url: string;
  /** エポックミリ秒。並びは 一致の強さ → 更新日時の新しい順（§7.3） */
  updatedAt: number;
  /** 語が件名に一致したか。本文だけの一致より先に並べる */
  titleMatched: boolean;
};

/** 1 回の検索（palette.md §7）。入力が変わると丸ごと捨てる */
export type SearchSession = {
  query: string;
  scope: Scope;
  kinds: Readonly<Record<SearchKind, KindProgress>>;
  /** 画面に出ている並び */
  rows: readonly ResultRow[];
  /** 選択行より上に入るはずで、選択が先頭に戻るまで待っている行（I4） */
  held: readonly ResultRow[];
  /** 表示上限 30 を超えて捨てた件数。external 行の「他 N 件」に出す */
  overflow: number;
};
