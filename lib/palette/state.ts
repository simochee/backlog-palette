import type { ToastView } from '@/components/types';
import type { SearchSession } from '@/lib/search/types';
import { emptyStack } from '@/lib/stack/stack';
import type { CommandSegment, ProjectSegment, SpaceSegment, Stack } from '@/lib/stack/types';

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
  | { type: 'opened'; stack: Stack }
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
  | { type: 'toastExpired' };
