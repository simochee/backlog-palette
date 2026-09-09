/**
 * 表示の語彙。Backlog のドメイン語をこのパッケージに持ち込まない（§5.2）。
 * packages/core の view 型と構造的に一致させる。
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
