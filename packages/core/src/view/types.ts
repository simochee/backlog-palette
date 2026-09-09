/**
 * 表示のための語彙。Backlog のドメイン語（課題・Wiki・スペース）を含めない。
 *
 * packages/ui の props はこの型と構造的に一致させる。両パッケージは
 * 互いを import しないので（§6.2）、一致は apps/extension 側の
 * 型アサーションで担保する。
 */
export type RowKind =
  | 'issue'
  | 'wiki'
  | 'document'
  | 'project'
  | 'space'
  | 'page'
  | 'command'
  | 'user'
  | 'connect'
  | 'filter'
  | 'external';

export type MarkerTone = 'neutral' | 'info' | 'success' | 'done' | 'warning' | 'danger';

export type RowMarker = { label: string; tone: MarkerTone };

export type RowHint = 'none' | 'enter' | 'modEnter' | 'more';

export type RowTone = 'default' | 'accent' | 'danger';

export type RowView = {
  kind: RowKind;
  code?: string;
  title: string;
  sub?: string;
  marker?: RowMarker;
  tag?: RowMarker;
  avatar?: { label: string };
  hint?: RowHint;
  selected?: boolean;
  tone?: RowTone;
};
