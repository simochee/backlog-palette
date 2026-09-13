import {
  ArrowUp,
  BookOpen,
  Building,
  CircleDot,
  ExternalLink,
  FileText,
  FolderKanban,
  Info,
  type LucideIcon,
  PanelRight,
  PanelsTopLeft,
  Plug,
  Search,
  Terminal,
  TriangleAlert,
} from 'lucide-react';

import type { RowKind } from '@/components/types';
import { cn } from '@/components/utils/cn';

type KindIconProps = {
  kind: RowKind;
  className?: string;
};

/** RowKind → アイコンの写像。呼び出し側はアイコン名を渡さない */
const icons: Record<RowKind, LucideIcon> = {
  page: PanelsTopLeft,
  issue: CircleDot,
  wiki: BookOpen,
  document: FileText,
  project: FolderKanban,
  space: Building,
  command: Terminal,
  search: Search,
  panel: PanelRight,
  connect: Plug,
  status: TriangleAlert,
  notice: ArrowUp,
  external: ExternalLink,
  hint: Info,
};

export function KindIcon({ kind, className }: KindIconProps) {
  const Icon = icons[kind];
  return (
    <Icon
      aria-hidden
      data-kind={kind}
      strokeWidth={1.75}
      className={cn('size-(--bp-size-icon) shrink-0', className)}
    />
  );
}
