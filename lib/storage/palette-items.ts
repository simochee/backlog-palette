import { storage } from '#imports';

/*
 * パレットの索引と個人化が読む defineItem。表示キャッシュ（displayCache）と鍵（apiKeys）、
 * レート枠（rateLimits）は M3 / M4 の items.ts にあり、ここには置かない。1 ファイルに集めると
 * 並行して進む PR が同じ行で衝突するので、M2 の分はこのファイルに分ける
 */
/** 行動ログの 1 件。entityId は `issue:PROJ-1` `project:1` `page:board` の形（lib/palette の entityId） */
export type ActivityRecord = { entityId: string; at: number };

/** 頻度 × 直近性の元（palette.md §9）。学習オフのときは増やさない */
export const activity = storage.defineItem<ActivityRecord[]>('local:activity', {
  fallback: [],
  version: 1,
});

/** 「課題を開いた後はボード」の 1 回分（D-16）。from は遷移元のページ種別、to は開いたページ id */
export type TransitionRecord = { from: string; to: string; at: number };

export const transitions = storage.defineItem<TransitionRecord[]>('local:transitions', {
  fallback: [],
  version: 1,
});

/** 検索の履歴。パネルの「最近の検索」（surfaces.md §5.2）。新しいものが先頭 */
export type SearchHistoryRecord = {
  query: string;
  scope:
    | { kind: 'space'; spaceId: string }
    | { kind: 'project'; spaceId: string; projectId: string };
  at: number;
};

export const searchHistory = storage.defineItem<SearchHistoryRecord[]>('local:searchHistory', {
  fallback: [],
  version: 1,
});

/** 語 → 開いた対象の学習（M6）。同じ語で同じ対象を開いた回数 */
export type QueryDictRecord = { query: string; entityId: string; count: number; at: number };

export const queryDict = storage.defineItem<QueryDictRecord[]>('local:queryDict', {
  fallback: [],
  version: 1,
});

/**
 * 登録したスペース。id はホスト（`demo.backlog.jp`）で apiKeys のキーと揃える。鍵は持たない。
 * label は表示名、icon は API から取ったスペース画像の data URL
 */
export type SpaceRecord = {
  id: string;
  host: string;
  label: string;
  icon?: string;
  connectedAt: number;
  /** 認証切れを検出したら立てる。パレットは connect / status 行で出す */
  needsReconnect?: boolean;
};

export const spaces = storage.defineItem<SpaceRecord[]>('local:spaces', {
  fallback: [],
  version: 1,
});

export type Settings = {
  theme: 'system' | 'light' | 'dark';
  language: 'system' | 'ja' | 'en';
  learning: boolean;
  telemetry: boolean;
};

export const defaultSettings: Settings = {
  theme: 'system',
  language: 'system',
  learning: true,
  telemetry: false,
};

/**
 * version を上げるときは migrations に `{ 2: (old: SettingsV1) => Settings }` の形で写しを足す。
 * 版は item ごとに独立で、読み手が値の形を疑わずに済むよう fallback は常に最新の形にする
 */
export const settings = storage.defineItem<Settings>('local:settings', {
  fallback: defaultSettings,
  version: 1,
});
