import type { Badge } from '@/components/types';
import type { ActivityEvent, TransitionEvent } from '@/lib/rank';
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

export type PaletteIndex = {
  spaces: readonly SpaceEntry[];
  projects: readonly ProjectEntry[];
  /** スコープで URL が組めるページ定義。根では共通のページ（個人設定・API キー）を返す */
  pagesFor: (scope: Scope) => readonly PageEntry[];
  issueUrl: (spaceId: string, issueKey: string) => string;
  /** 本体の課題検索へ逃がす URL（§7.3 の上限超過・§7.5 の 0 件） */
  externalSearchUrl: (scope: Scope, query: string) => string;
  cache: readonly CachedEntry[];
  /** 担当課題。API から届くまでは undefined（空状態は待たずに描く） */
  assigned: readonly CachedEntry[] | undefined;
  /** 行動ログ。entityId は `issue:PROJ-1` `project:1` `page:board` の形 */
  activity: readonly ActivityEvent[];
  transitions: readonly TransitionEvent[];
  /** 現在ページの種別。遷移パターンの from */
  currentPageKind: string | undefined;
  /** 課題ページで開いたとき。コピー系コマンドの対象 */
  currentIssue: CurrentIssue | undefined;
  learningEnabled: boolean;
  now: number;
};

export const entityId = (kind: string, id: string): string => `${kind}:${id}`;
