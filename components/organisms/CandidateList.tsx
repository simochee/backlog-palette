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

/** ↑↓ の移動先。端で止まり、循環しない（palette.md §6） */
export function moveSelection(
  sections: readonly SectionView[],
  selectedId: string | undefined,
  delta: 1 | -1,
): string | undefined {
  const rows = flattenRows(sections);
  if (rows.length === 0) return undefined;
  const index = rows.findIndex((row) => row.id === selectedId);
  if (index === -1) return rows[0]?.id;
  const next = rows[index + delta];
  return next?.id;
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
