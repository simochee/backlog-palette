import {
  ArrowUpRight,
  BookOpen,
  Building2,
  CircleDot,
  FileText,
  Filter,
  Folder,
  LayoutPanelLeft,
  Plug,
  SquareTerminal,
  User,
} from 'lucide-react';
import type { RowKind } from './types.ts';

/**
 * kind → アイコンの唯一の写像。呼び出し側にアイコン名を渡させない。
 * アイコンセットを差し替えるときに書き換えるのはこのファイルだけ（§8.3）。
 */
const ICONS = {
  issue: CircleDot,
  wiki: BookOpen,
  document: FileText,
  project: Folder,
  space: Building2,
  page: LayoutPanelLeft,
  command: SquareTerminal,
  user: User,
  connect: Plug,
  filter: Filter,
  external: ArrowUpRight,
} as const satisfies Record<RowKind, unknown>;

export type RowIconProps = {
  kind: RowKind;
  size?: number;
};

export function RowIcon({ kind, size = 16 }: RowIconProps) {
  const Glyph = ICONS[kind];
  return <Glyph size={size} strokeWidth={1.75} aria-hidden />;
}
