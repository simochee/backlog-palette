export const rowKinds = [
  'page',
  'issue',
  'wiki',
  'document',
  'project',
  'space',
  'command',
  'search',
  'panel',
  'connect',
  'status',
  'notice',
  'external',
  'hint',
] as const;
export type RowKind = (typeof rowKinds)[number];

export const tones = ['neutral', 'info', 'success', 'done', 'warning', 'danger'] as const;
export type Tone = (typeof tones)[number];
export type Badge = { label: string; tone: Tone };

/**
 * 行が持つ動作。空なら Enter で何も起きず、ヒントも出ない（不変条件 I1）。
 * complete / stack は ⇥ の意味（補完か、スタックに積むか）。両方は持たない
 */
export type RowHint = 'enter' | 'modEnter' | 'descend' | 'complete' | 'stack';

export type RowTone = 'default' | 'accent' | 'danger';

export type RowView = {
  /** セクションを横断して一意。同じ対象が複数のセクションに並ぶときは container が接頭辞で分ける（選択と ↑↓ は id で引く） */
  id: string;
  kind: RowKind;
  code?: string;
  title: string;
  sub?: string;
  marker?: Badge;
  /** 期限。急ぎのときだけ渡る（期限切れ・7 日以内、D-50） */
  due?: Badge;
  tag?: Badge;
  space?: { label: string; icon?: string };
  hints: readonly RowHint[];
  tone?: RowTone;
  busy?: boolean;
};

export type SectionView = {
  id: string;
  label?: string;
  meta?: string;
  rows: readonly RowView[];
};

export type PathSegmentView = {
  id: string;
  label: string;
  badge?: boolean;
  icon?: string;
  armed?: boolean;
  compact?: boolean;
};

export type KeyHintId = 'enter' | 'modEnter' | 'move' | 'back' | 'take' | 'copyUrl' | 'toPanel';

/** フッターのキーヒント。container が KeyBinding から導出して渡す（不変条件 I2） */
export type KeyHint = {
  id: KeyHintId;
  keys: readonly string[];
  label: string;
  /** 幅が足りないときに使う短い言い方。無ければ label をそのまま使う */
  shortLabel?: string;
  priority: number;
};

export type ToastView = { message: string; detail?: string };

export type PaletteView = {
  path: readonly PathSegmentView[];
  input: { value: string; placeholder: string; completion?: string };
  armedNotice?: string;
  escLabel: string;
  sections: readonly SectionView[];
  selectedId?: string;
  footer: readonly KeyHint[];
  toast?: ToastView;
};

export type FilterOption = { id: string; label: string; count?: number; tone?: Tone };
export type FilterField = {
  id: string;
  label: string;
  value: string;
  options: readonly FilterOption[];
  neutralValue?: string;
};

/** 検索の単位（種別）ごとの進捗。スペース横断はしない（D-20）ので単位はスペースではない */
export type SearchProgress = {
  id: string;
  label: string;
  state: 'loading' | 'ready' | 'error';
  count?: number;
  message?: string;
  action?: { label: string };
};

export type PanelView = {
  input: { value: string; placeholder: string };
  recentQueries: readonly string[];
  filters: readonly FilterField[];
  progress: readonly SearchProgress[];
  sections: readonly SectionView[];
  selectedId?: string;
  footer: readonly KeyHint[];
  toast?: ToastView;
  /** いま出ている結果を検索した語。入力がこれと違えば、Enter は行を開かずに検索しなおす */
  searchedQuery?: string;
};

export type ConnectSheetState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; spaceLabel: string };

export type SpaceItemView = {
  id: string;
  label: string;
  host: string;
  projectCount: number;
  lastSyncedAt: string;
  icon?: string;
  state: 'connected' | 'needsReconnect';
};
