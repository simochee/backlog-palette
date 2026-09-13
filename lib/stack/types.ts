export type SpaceSegment = {
  kind: 'space';
  spaceId: string;
  /** 表示名（スペース名。キーではない） */
  label: string;
  /** スペースのアイコン画像（data URL）。無ければ頭文字で描く */
  icon?: string;
};

export type ProjectSegment = {
  kind: 'project';
  projectId: string;
  projectKey: string;
  label: string;
};

export type CommandSegment = {
  kind: 'command';
  commandId: string;
  label: string;
};

export type Segment = SpaceSegment | ProjectSegment | CommandSegment;

/**
 * パレットの階層（palette.md §8）。左から右へ積み、右端が今いる段。
 * `project` の前には必ず `space` があり、`command` の後には何も積めない。
 */
export type Stack = {
  readonly segments: readonly Segment[];
  /** ⌫ の 1 回目で立つ。2 回目で右端が外れる。入力文字は消えない */
  readonly armedForDelete: boolean;
};

/** 検索と候補の範囲。スペース横断は無い（D-20） */
export type Scope =
  | { kind: 'root' }
  | { kind: 'space'; spaceId: string }
  | { kind: 'project'; spaceId: string; projectId: string };
