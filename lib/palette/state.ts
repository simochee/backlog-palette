import type { ToastView } from '@/components/types';
import type { ResultRow, SearchError, SearchKind, SearchSession } from '@/lib/search/types';
import { emptyStack } from '@/lib/stack/stack';
import type { CommandSegment, ProjectSegment, Scope, SpaceSegment, Stack } from '@/lib/stack/types';

/** palette.md §2 の状態モデル。スコープ・セクション・フッターはここから導き、別に持たない */
export type PaletteState = {
  stack: Stack;
  /** 入力欄の文字列。IME 未確定を含む */
  input: string;
  /** undefined は先頭行。入力が変わるたびに先頭へ戻る（§4） */
  selectedId: string | undefined;
  session: SearchSession | undefined;
  toast: ToastView | undefined;
};

export const initialState: PaletteState = {
  stack: emptyStack,
  input: '',
  selectedId: undefined,
  session: undefined,
  toast: undefined,
};

/** ⇥ で取り込むもの。積むか、タイトルで入力を置き換えるか（D-4） */
export type TakeTarget =
  | { kind: 'space'; space: SpaceSegment }
  | { kind: 'project'; space: SpaceSegment; project: ProjectSegment }
  | { kind: 'command'; command: CommandSegment }
  | { kind: 'complete'; text: string };

export type PaletteAction =
  /** 前回の入力・選択・検索を捨てる。材料を待たず、開いた瞬間に同期で起こす（§3） */
  | { type: 'opened' }
  /** 開いたページから決まるスタックを置く。材料が揃う前に打たれた入力は残す */
  | { type: 'located'; stack: Stack }
  | { type: 'inputChanged'; value: string }
  | { type: 'selected'; id: string }
  | { type: 'took'; target: TakeTarget }
  /** 2 段階コマンドの行で ↵ */
  | { type: 'descended'; command: CommandSegment }
  | { type: 'backspacedAtStart' }
  | { type: 'escaped' }
  /** 上のどれでもないキー。削除待ちとトーストを消す */
  | { type: 'keyPressed' }
  | { type: 'toasted'; toast: ToastView }
  | { type: 'toastExpired' }
  /** 検索行で ↵（§7.1）。選択はプレースホルダへ移る */
  | { type: 'searchStarted'; query: string; scope: Scope }
  /** 種別単位の到着（§7.3）。到着も reducer に届く 1 アクション */
  | { type: 'resultsArrived'; kind: SearchKind; rows: readonly ResultRow[] }
  | { type: 'searchFailed'; kind: SearchKind; error: SearchError }
  /** notice 行の ↵。保留を合流させて選択を先頭へ */
  | { type: 'heldMerged' };
