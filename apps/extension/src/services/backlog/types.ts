/**
 * Backlog API v2 のレスポンスのうち、この拡張が読む部分だけを写した型
 * （実装プラン §20、`docs/backlog-facts.md` §3・§6.3）。
 *
 * backlog-js の型をそのまま外へ出さない。ライブラリの型は自スペースの実測と
 * 食い違う箇所があり（Wiki 一覧の `content` は返るのに型に無い）、
 * 差し替えたときに呼び出し側が壊れる面を狭くしておきたい。
 */

export type BacklogUser = {
  readonly id: number;
  readonly userId?: string | null;
  readonly name: string;
};

export type BacklogProject = {
  readonly id: number;
  readonly projectKey: string;
  readonly name: string;
  readonly archived: boolean;
  readonly displayOrder: number;
  readonly useWiki: boolean;
};

export type BacklogStatus = {
  readonly id: number;
  readonly projectId: number;
  readonly name: string;
  readonly color: string;
  readonly displayOrder: number;
};

export type BacklogIssueType = {
  readonly id: number;
  readonly projectId: number;
  readonly name: string;
  readonly color: string;
};

export type BacklogPriority = {
  readonly id: number;
  readonly name: string;
};

export type BacklogIssue = {
  readonly id: number;
  readonly projectId: number;
  readonly issueKey: string;
  readonly keyId: number;
  readonly summary: string;
  readonly description: string;
  readonly issueType: BacklogIssueType;
  readonly status: BacklogStatus;
  readonly priority: BacklogPriority;
  readonly assignee?: BacklogUser | null;
  readonly parentIssueId?: number | null;
  readonly startDate?: string | null;
  readonly dueDate?: string | null;
  readonly createdUser: BacklogUser;
  readonly created: string;
  readonly updatedUser: BacklogUser;
  readonly updated: string;
};

export type BacklogTag = {
  readonly id: number;
  readonly name: string;
};

export type BacklogWiki = {
  readonly id: number;
  readonly projectId: number;
  readonly name: string;
  /** 一覧レスポンスにも本文が入る（台帳 §6.3 の実測。公式ドキュメントの記述とは逆） */
  readonly content?: string;
  readonly tags: readonly BacklogTag[];
  readonly createdUser: BacklogUser;
  readonly created: string;
  readonly updatedUser: BacklogUser;
  readonly updated: string;
};

export type BacklogDocument = {
  readonly id: string;
  readonly projectId: number;
  readonly title: string;
  /** 本文のプレーンテキスト。ドキュメントだけは一覧からスニペットを作れる */
  readonly plain: string;
  readonly statusId: number;
  readonly emoji?: string | null;
  readonly tags: readonly BacklogTag[];
  readonly createdUser: BacklogUser;
  readonly created: string;
  readonly updatedUser: BacklogUser;
  readonly updated: string;
};

export type SortOrder = 'asc' | 'desc';

export type IssueSortKey =
  | 'issueType'
  | 'category'
  | 'version'
  | 'milestone'
  | 'summary'
  | 'status'
  | 'priority'
  | 'created'
  | 'updated'
  | 'assignee'
  | 'startDate'
  | 'dueDate';

/** 1 件以上を型で要求する。空配列はパラメータ無しと同じくエラーになる */
export type NonEmpty<T> = readonly [T, ...T[]];

export type IssueSearchParams = {
  /**
   * 必須。`GET /issues` はプロジェクト指定が無いとエラーを返す（台帳 §6.3）。
   * 名前やキーでは絞れないので ID を渡す（§3.2）。
   */
  readonly projectId: NonEmpty<number>;
  readonly keyword?: string;
  readonly statusId?: readonly number[];
  readonly assigneeId?: readonly number[];
  readonly issueTypeId?: readonly number[];
  readonly count?: number;
  readonly offset?: number;
  readonly sort?: IssueSortKey;
  readonly order?: SortOrder;
  readonly updatedSince?: string;
  readonly updatedUntil?: string;
};

export type WikiSearchParams = {
  /** 必須。Wiki 一覧はプロジェクト単位でしか呼べない（§3.3） */
  readonly projectIdOrKey: string | number;
  /**
   * 必須にしている。`count` が効かず全件返るため（台帳 §6.3）、
   * キーワード無しの一覧取得を呼び出し側に選ばせない。
   */
  readonly keyword: string;
};

export type DocumentSearchParams = {
  readonly projectIds: NonEmpty<number>;
  readonly keyword?: string;
  /** 必須（§3.4）。省略できるかは確認できていないので型でも要求する */
  readonly offset: number;
  readonly count?: number;
  readonly sort?: 'created' | 'updated';
  readonly order?: SortOrder;
};

/** 生の GET に渡せる値。配列は `key[]=v1&key[]=v2` に展開される */
export type QueryParams = Record<string, string | number | readonly (string | number)[]>;
