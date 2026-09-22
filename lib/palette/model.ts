import type { Badge } from '@/components/types';
import type { ActivityEvent, QueryDictEvent, TransitionEvent } from '@/lib/rank';
import type { SearchError } from '@/lib/search/types';
import type { Scope } from '@/lib/stack/types';

/**
 * derive が読むローカル索引。URL はすべて組み終わった形で受け取り、lib/palette は
 * ホストやパスの事実を知らない（それは lib/nav の仕事）。
 */
export type SpaceEntry = {
  id: string;
  /** 表示名（スペース名。キーではない） */
  label: string;
  host: string;
  icon?: string;
  connected: boolean;
  /** ダッシュボードの URL */
  url: string;
};

export type ProjectEntry = {
  id: string;
  key: string;
  name: string;
  spaceId: string;
  url: string;
};

export type PageEntry = {
  id: string;
  title: string;
  /** 英字の別名とかなの読み。ローマ字入力はここに届く（D-15） */
  aliases: readonly string[];
  /** 現在ページの種別としても使う（遷移パターンの from） */
  kind: string;
  url: string;
};

export type EntityKind = 'issue' | 'wiki' | 'document';

/** 表示キャッシュの 1 件。担当課題の到着も同じ形で受ける */
export type CachedEntry = {
  kind: EntityKind;
  id: string;
  key?: string;
  title: string;
  spaceId: string;
  projectId: string;
  projectName: string;
  assignee?: string;
  updatedBy?: string;
  status?: Badge;
  type?: Badge;
  url: string;
};

export type CurrentIssue = { key: string; title: string; url: string };

/**
 * 担当課題。空状態で API が要る唯一の材料なので、取得中と失敗を状態として持つ。
 * `undefined` で失敗も表すと、取れなかったときに「読み込み中」が回り続ける（I6）
 */
export type AssignedState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: readonly CachedEntry[] }
  | { kind: 'failed'; error: SearchError };

export type PaletteIndex = {
  spaces: readonly SpaceEntry[];
  projects: readonly ProjectEntry[];
  /** スコープで URL が組めるページ定義。根では共通のページ（個人設定・API キー）を返す */
  pagesFor: (scope: Scope) => readonly PageEntry[];
  issueUrl: (spaceId: string, issueKey: string) => string;
  /** 本体の課題検索へ逃がす URL（§7.3 の上限超過・§7.5 の 0 件） */
  externalSearchUrl: (scope: Scope, query: string) => string;
  cache: readonly CachedEntry[];
  /** 担当課題。届くまでは loading（空状態は待たずに描く）、取れなければ failed */
  assigned: AssignedState;
  /** 行動ログ。entityId は `issue:PROJ-1` `project:1` `page:board` の形 */
  activity: readonly ActivityEvent[];
  transitions: readonly TransitionEvent[];
  /** 語 → 開いた対象の学習（M6）。語は fold 済み。同じ強さの候補の中でだけ効く */
  queryDict: readonly QueryDictEvent[];
  /** 現在ページの種別。遷移パターンの from */
  currentPageKind: string | undefined;
  /** 今開いているページの URL。空状態はここへ戻る行を出さない（§9） */
  currentUrl: string | undefined;
  /** 課題ページで開いたとき。コピー系コマンドの対象 */
  currentIssue: CurrentIssue | undefined;
  learningEnabled: boolean;
  now: number;
};

export const entityId = (kind: string, id: string): string => `${kind}:${id}`;
