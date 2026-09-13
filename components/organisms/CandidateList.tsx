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

export function CandidateList({ id, sections, selectedId, onAction, ...aria }: CandidateListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeDescendant = selectedId ? optionDomId(id, selectedId) : undefined;

  useEffect(() => {
    if (!activeDescendant) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(activeDescendant)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeDescendant]);

  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={aria['aria-label']}
      aria-activedescendant={activeDescendant}
      // 行のクリックで入力欄からフォーカスが抜けると次の打鍵が届かなくなる。
      // 選択はクリックの click で伝えるので、mousedown の既定動作だけを止める。
      onMouseDown={(event) => event.preventDefault()}
      className="py-1"
    >
      {sections.map((section) => {
        const headerId = `${id}-section-${section.id}`;
        return (
          <div
            key={section.id}
            role="group"
            aria-labelledby={section.label ? headerId : undefined}
            data-section-id={section.id}
          >
            {section.label && (
              <SectionHeader id={headerId} label={section.label} meta={section.meta} />
            )}
            {section.rows.map((row) => (
              <ResultRow
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                optionId={optionDomId(id, row.id)}
                onClick={() => onAction(row.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
