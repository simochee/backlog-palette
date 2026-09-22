import { useEffect, useRef } from 'react';

import { ResultRow } from '@/components/molecules/ResultRow';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import type { RowView, SectionView } from '@/components/types';

type CandidateListProps = {
  id: string;
  sections: readonly SectionView[];
  selectedId?: string;
  onAction: (id: string) => void;
  'aria-label': string;
};

export function optionDomId(listId: string, rowId: string): string {
  return `${listId}-option-${rowId}`;
}

export function flattenRows(sections: readonly SectionView[]): RowView[] {
  return sections.flatMap((section) => section.rows);
}

/** 選択が止まってよい行。動作を持たない行は Enter が効かない（不変条件 I1） */
export const isSelectable = (row: RowView): boolean => row.hints.length > 0;

/**
 * ↑↓ の移動先。端で止まり、循環しない（palette.md §6）。
 * 動作を持たない行（案内・検索中のプレースホルダ）は飛ばす。飛ばさないと、
 * 選択の見た目（罫・反転・太字）が「この行で ↵ が効く」と言うのに何も起きない行ができる。
 * 選択が既にその種の行にあるとき（§7.2 のプレースホルダ）は、その位置から数えて隣を返す
 */
export function neighbourRow(
  rows: readonly RowView[],
  selectedId: string | undefined,
  delta: 1 | -1,
): RowView | undefined {
  const index = rows.findIndex((row) => row.id === selectedId);
  if (index === -1) return rows.find(isSelectable);
  for (let next = index + delta; next >= 0 && next < rows.length; next += delta) {
    const row = rows[next];
    if (row !== undefined && isSelectable(row)) return row;
  }
  return undefined;
}

export function moveSelection(
  sections: readonly SectionView[],
  selectedId: string | undefined,
  delta: 1 | -1,
): string | undefined {
  return neighbourRow(flattenRows(sections), selectedId, delta)?.id;
}

function SectionGroup({
  listId,
  section,
  selectedId,
  onAction,
}: {
  listId: string;
  section: SectionView;
  selectedId: string | undefined;
  onAction: (id: string) => void;
}) {
  const headerId = `${listId}-section-${section.id}`;
  return (
    <div
      role="group"
      aria-labelledby={section.label === undefined ? undefined : headerId}
      data-section-id={section.id}
    >
      {section.label !== undefined && (
        <SectionHeader id={headerId} label={section.label} meta={section.meta} />
      )}
      {section.rows.map((row) => (
        <ResultRow
          key={row.id}
          row={row}
          selected={row.id === selectedId}
          optionId={optionDomId(listId, row.id)}
          onClick={() => onAction(row.id)}
        />
      ))}
    </div>
  );
}

export function CandidateList({ id, sections, selectedId, onAction, ...aria }: CandidateListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeDescendant = selectedId === undefined ? undefined : optionDomId(id, selectedId);

  useEffect(() => {
    if (activeDescendant === undefined) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(activeDescendant)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeDescendant]);

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      tabIndex={-1}
      aria-label={aria['aria-label']}
      aria-activedescendant={activeDescendant}
      // 行のクリックで入力欄からフォーカスが抜けると次の打鍵が届かなくなる。
      // 選択はクリックの click で伝えるので、mousedown の既定動作だけを止める。
      onMouseDown={(event) => event.preventDefault()}
      className="py-1 outline-none"
    >
      {sections.map((section) => (
        <SectionGroup
          key={section.id}
          listId={id}
          section={section}
          selectedId={selectedId}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
